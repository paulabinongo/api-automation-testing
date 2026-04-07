/**
 * Practice “bank” loan API — same behavior as the former Python mock.
 * Run: npm run start:mock
 */
import 'dotenv/config'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'crypto'

import { PAYMENT_METHODS } from '../loanConstants.js'
import {
  buildLoanProductReferencePayload,
  PERSONAL_LOAN_PRODUCT,
  validateApplicationAgainstCatalog,
} from '../loanProductCatalog.js'
import { computePersonalLoanPreview } from '../personalLoanComputation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const openApiSpec = JSON.parse(readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'))

const API_SEMANTIC_VERSION = openApiSpec.info.version
const BANK_ENV = process.env.BANK_API_ENV || 'sandbox'

/** @param {import('express').Request} req @param {import('express').Response} res @param {number} status @param {string | string[]} detail */
function sendError(req, res, status, detail) {
  res.status(status).json({
    detail,
    correlation_id: req.correlationId,
    timestamp: new Date().toISOString(),
  })
}

function correlationAndSecurityHeaders(req, res, next) {
  const requireCorr = process.env.BANK_REQUIRE_CORRELATION_ID === '1'
  if (requireCorr && !req.get('x-correlation-id') && !req.get('x-request-id')) {
    const syn = uuid()
    res.setHeader('X-Correlation-Id', syn)
    res.setHeader('X-Request-Id', syn)
    return res.status(400).json({
      detail:
        'X-Correlation-Id or X-Request-Id is required in this environment (BANK_REQUIRE_CORRELATION_ID)',
      correlation_id: syn,
      timestamp: new Date().toISOString(),
    })
  }
  const incoming = req.get('x-correlation-id') || req.get('x-request-id') || uuid()
  req.correlationId = incoming
  res.setHeader('X-Correlation-Id', incoming)
  res.setHeader('X-Request-Id', incoming)
  res.setHeader('X-API-Environment', BANK_ENV)
  res.setHeader('X-API-Revision', API_SEMANTIC_VERSION)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  next()
}

const rateState = new Map()

function rateLimitMiddleware(req, res, next) {
  const limit = Number(process.env.BANK_API_RATE_LIMIT_PER_MINUTE || 0)
  if (!Number.isFinite(limit) || limit <= 0) return next()
  const now = Date.now()
  const win = 60_000
  const key = req.ip || 'unknown'
  let b = rateState.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + win }
    rateState.set(key, b)
  }
  b.count++
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - b.count)))
  if (b.count > limit) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retry))
    return res.status(429).json({
      detail:
        'Rate limit exceeded — wait for Retry-After before retrying (BANK_API_RATE_LIMIT_PER_MINUTE)',
      correlation_id: req.correlationId,
      timestamp: new Date().toISOString(),
      retry_after_seconds: retry,
    })
  }
  next()
}

/** @type {Map<string, { bodyHash: string, status: number, body: unknown }>} */
const idemStore = new Map()
const IDEM_MAX = 2500

function idempotencyForAuthedPosts(req, res, next) {
  if (req.method !== 'POST') return next()
  const raw = req.headers['idempotency-key']
  if (raw == null || raw === '') return next()
  const idemKey = String(raw).trim().slice(0, 128)
  if (!idemKey) return next()
  const pathOnly = req.originalUrl.split('?')[0]
  const bodyHash = JSON.stringify(req.body ?? {})
  const scopedKey = `${req.accessToken}:${idemKey}:${pathOnly}`
  const hit = idemStore.get(scopedKey)
  if (hit) {
    if (hit.bodyHash !== bodyHash) {
      return sendError(
        req,
        res,
        409,
        'Idempotency-Key was reused with a different request body — use a new key for a new intent',
      )
    }
    res.setHeader('Idempotent-Replayed', 'true')
    return res.status(hit.status).json(hit.body)
  }
  const origJson = res.json.bind(res)
  res.json = (payload) => {
    res.json = origJson
    const code = res.statusCode || 200
    if (code >= 200 && code < 300) {
      if (idemStore.size >= IDEM_MAX) {
        const first = idemStore.keys().next().value
        idemStore.delete(first)
      }
      /** @type {unknown} */
      let bodyClone = payload
      try {
        bodyClone = JSON.parse(JSON.stringify(payload))
      } catch {
        /* non-serializable edge — store as-is */
      }
      idemStore.set(scopedKey, { bodyHash, status: code, body: bodyClone })
    }
    return origJson(payload)
  }
  next()
}

const app = express()
if (process.env.BANK_TRUST_PROXY === '1') app.set('trust proxy', 1)
app.use(correlationAndSecurityHeaders)
app.use(rateLimitMiddleware)
app.use(express.json())

app.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec)
})
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))
app.get('/', (_req, res) => {
  res.redirect('/docs')
})

/** @type {Map<string, object>} */
const applications = new Map()
/** @type {Map<string, object>} */
const loans = new Map()
/** @type {Map<string, { user_id: string, email: string, kyc: null | object }>} */
const sessions = new Map()

function uuid() {
  return randomUUID()
}

function creditRef() {
  return 'CR-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** @param {object[]} stips */
function allStipulationsFulfilled(stips) {
  return stips.length > 0 && stips.every((s) => s.fulfilled)
}

function getApp(applicationId) {
  const row = applications.get(applicationId)
  if (!row) return null
  return row
}

function getLoanRow(loanId) {
  const row = loans.get(loanId)
  if (!row) return null
  return row
}

/** Strip internal **owner_user_id** from API responses. */
function sanitizeApplicationOut(row) {
  if (!row || typeof row !== 'object') return row
  const { owner_user_id: _omit, ...rest } = row
  return rest
}

/** First of month after "today + ~1 month" — matches prior Python demo logic. */
function scheduleStartDate() {
  const d = new Date()
  let start = new Date(d.getFullYear(), d.getMonth(), 1)
  start.setDate(start.getDate() + 32)
  start = new Date(start.getFullYear(), start.getMonth(), 1)
  return start
}

function validateCreateBody(body) {
  return validateApplicationAgainstCatalog(body)
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(\S+)/i.exec(h)
  if (!m) {
    return sendError(req, res, 401, 'Authorization: Bearer <access_token> required')
  }
  const token = m[1]
  const sess = sessions.get(token)
  if (!sess) {
    return sendError(
      req,
      res,
      401,
      'Invalid or expired session — login again or call POST /v1/auth/logout was already used',
    )
  }
  req.bankSession = sess
  req.accessToken = token
  next()
}

const v1 = express.Router()

function sendHealth(_req, res) {
  res.json({
    status: 'UP',
    environment: BANK_ENV,
    api_revision: API_SEMANTIC_VERSION,
    time: new Date().toISOString(),
  })
}

function sendLoanProductReference(_req, res) {
  res.json(buildLoanProductReferencePayload())
}

function sendLoanComputationPreview(req, res) {
  const principalCents = req.query.principal_cents != null ? Number(req.query.principal_cents) : NaN
  const termMonths = req.query.term_months != null ? Number(req.query.term_months) : NaN
  const errs = []
  if (!Number.isFinite(principalCents) || principalCents !== Math.round(principalCents)) {
    errs.push('principal_cents must be a whole number (PHP centavos)')
  }
  if (
    !Number.isFinite(termMonths) ||
    !PERSONAL_LOAN_PRODUCT.allowed_term_months.includes(termMonths)
  ) {
    errs.push('term_months must be one of: ' + PERSONAL_LOAN_PRODUCT.allowed_term_months.join(', '))
  }
  if (errs.length) return sendError(req, res, 422, errs)
  if (
    principalCents < PERSONAL_LOAN_PRODUCT.min_principal_cents ||
    principalCents > PERSONAL_LOAN_PRODUCT.max_principal_cents
  ) {
    return sendError(
      req,
      res,
      422,
      `principal_cents must be between ${PERSONAL_LOAN_PRODUCT.min_principal_cents} and ${PERSONAL_LOAN_PRODUCT.max_principal_cents} (catalogue limits)`,
    )
  }
  const out = computePersonalLoanPreview(principalCents, termMonths)
  if (!out) return sendError(req, res, 422, ['Unsupported term_months for computation'])
  res.json(out)
}

/** Uses **principal_cents** and **term_months** from the borrower’s draft application (same session owner). */
function sendLoanComputationPreviewFromApplication(req, res) {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id != null && row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Not allowed to access this application')
  }
  const out = computePersonalLoanPreview(row.principal_cents, row.term_months)
  if (!out) return sendError(req, res, 422, ['Unsupported term_months for computation'])
  res.json({ ...out, application_id: row.id })
}

/** Canonical paths + `/v1/...` aliases when `base_url` already ends with `/v1` (avoids falling through to auth). */
v1.get('/health', sendHealth)
v1.get('/v1/health', sendHealth)
v1.get('/reference/loan-products', sendLoanProductReference)
v1.get('/v1/reference/loan-products', sendLoanProductReference)
v1.get('/reference/loan-computation-preview', sendLoanComputationPreview)
v1.get('/v1/reference/loan-computation-preview', sendLoanComputationPreview)

v1.post('/auth/login', (req, res) => {
  const body = req.body || {}
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) {
    return sendError(req, res, 422, ['email and password required'])
  }
  if (password !== 'demo' && password !== 'demo123') {
    return sendError(
      req,
      res,
      401,
      'Invalid credentials — sandbox accepts password **demo** or **demo123** with any email',
    )
  }
  const token = uuid()
  const user_id = uuid()
  sessions.set(token, { user_id, email, kyc: null })
  res.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3600,
    user: { id: user_id, email },
  })
})

v1.use(authRequired)
v1.use(idempotencyForAuthedPosts)

v1.post('/auth/logout', (req, res) => {
  sessions.delete(req.accessToken)
  res.status(204).end()
})

v1.get('/auth/me', (req, res) => {
  const k = req.bankSession.kyc
  res.json({
    user: { id: req.bankSession.user_id, email: req.bankSession.email },
    kyc_complete: Boolean(k && k.status === 'VERIFIED'),
    kyc_id: k?.kyc_id ?? null,
    kyc_status: k?.status ?? 'NOT_STARTED',
  })
})

v1.get('/onboarding/status', (req, res) => {
  const k = req.bankSession.kyc
  res.json({
    kyc_complete: Boolean(k && k.status === 'VERIFIED'),
    kyc_id: k?.kyc_id ?? null,
    status: k?.status ?? 'NOT_STARTED',
  })
})

v1.post('/onboarding/kyc', (req, res) => {
  const body = req.body || {}
  const errs = []
  if (!body.full_name) errs.push('full_name required')
  if (!body.email) errs.push('email required')
  if (!body.date_of_birth) errs.push('date_of_birth required (use YYYY-MM-DD)')
  const last4 = body.national_id_last4 != null ? String(body.national_id_last4) : ''
  if (!/^\d{4}$/.test(last4)) errs.push('national_id_last4 must be exactly 4 digits')
  if (errs.length) return sendError(req, res, 422, errs)
  const kyc_id = uuid()
  req.bankSession.kyc = {
    kyc_id,
    status: 'VERIFIED',
    verified_at: new Date().toISOString(),
    full_name: body.full_name,
    email: String(body.email).trim(),
    date_of_birth: body.date_of_birth,
  }
  res.json({
    kyc_id,
    status: 'VERIFIED',
    message: 'Sandbox: customer KYC simulated as verified — you may start a loan application.',
  })
})

v1.post('/loan-applications', (req, res) => {
  const k = req.bankSession.kyc
  if (!k || k.status !== 'VERIFIED') {
    return sendError(
      req,
      res,
      403,
      'Complete customer onboarding first: POST /v1/onboarding/kyc with a logged-in session, then create an application',
    )
  }
  const errors = validateCreateBody(req.body)
  if (errors.length) {
    return sendError(req, res, 422, errors)
  }
  const { product_code, principal_cents, term_months, borrower } = req.body
  const aid = uuid()
  const row = {
    id: aid,
    status: 'DRAFT',
    product_code,
    principal_cents,
    term_months,
    borrower: { ...borrower },
    loan_id: null,
    stipulations: [],
    decline_reason_code: null,
    credit_reference_id: null,
    disclosures_acknowledged_at: null,
    owner_user_id: req.bankSession.user_id,
  }
  applications.set(aid, row)
  res.status(200).json(sanitizeApplicationOut(row))
})

v1.get('/loan-applications/:applicationId', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  res.json(sanitizeApplicationOut(row))
})

v1.get(
  '/loan-applications/:applicationId/computation-preview',
  sendLoanComputationPreviewFromApplication,
)

v1.post('/loan-applications/:applicationId/submit', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'DRAFT') {
    return sendError(req, res, 409, 'Invalid state for submit')
  }
  row.status = 'SUBMITTED'
  res.json(sanitizeApplicationOut(row))
})

/** LOS: processing / ops accepts the file into the working queue (after borrower submit). */
v1.post('/loan-applications/:applicationId/processing/accept', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'SUBMITTED') {
    return sendError(
      req,
      res,
      409,
      'processing/accept requires SUBMITTED (current: ' +
        row.status +
        '). Call POST …/submit first.',
    )
  }
  row.status = 'IN_PROCESSING'
  res.json(sanitizeApplicationOut(row))
})

/** Reg-TILA-style initial disclosure package acknowledged (sandbox: one POST). */
v1.post('/loan-applications/:applicationId/disclosures/acknowledge', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'IN_PROCESSING') {
    return sendError(
      req,
      res,
      409,
      'disclosures/acknowledge requires IN_PROCESSING (current: ' +
        row.status +
        '). Call POST …/processing/accept first.',
    )
  }
  if (!row.disclosures_acknowledged_at) {
    row.disclosures_acknowledged_at = new Date().toISOString()
  }
  res.json(sanitizeApplicationOut(row))
})

v1.post('/loan-applications/:applicationId/credit-check', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'IN_PROCESSING') {
    return sendError(
      req,
      res,
      409,
      'Application must be IN_PROCESSING for credit check (current status: ' +
        row.status +
        '). Call POST …/processing/accept after submit, POST …/disclosures/acknowledge, then credit-check. If credit already completed, start underwriting instead — do not call credit-check again.',
    )
  }
  if (!row.disclosures_acknowledged_at) {
    return sendError(
      req,
      res,
      409,
      'Initial disclosures must be acknowledged before credit: POST …/disclosures/acknowledge',
    )
  }
  const body = req.body || {}
  if (body.force_outcome === 'FAIL') {
    row.status = 'DECLINED'
    row.decline_reason_code = 'CREDIT_POLICY'
    return res.json(sanitizeApplicationOut(row))
  }
  if (body.force_outcome === 'PASS') {
    row.status = 'CREDIT_COMPLETED'
    row.credit_reference_id = creditRef()
    return res.json(sanitizeApplicationOut(row))
  }
  const score = body.simulated_credit_score
  if (score != null && score < 620) {
    row.status = 'DECLINED'
    row.decline_reason_code = 'CREDIT_THRESHOLD'
    return res.json(sanitizeApplicationOut(row))
  }
  row.status = 'CREDIT_COMPLETED'
  row.credit_reference_id = creditRef()
  res.json(sanitizeApplicationOut(row))
})

/** Underwriting queue: credit done, waiting for underwriter decision. */
v1.post('/loan-applications/:applicationId/underwriting/start', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'CREDIT_COMPLETED') {
    return sendError(
      req,
      res,
      409,
      'underwriting/start requires CREDIT_COMPLETED (current: ' +
        row.status +
        '). Run credit-check first.',
    )
  }
  row.status = 'IN_UNDERWRITING'
  res.json(sanitizeApplicationOut(row))
})

function createLoanRecord(applicationId, appRow, loanStatus) {
  const lid = uuid()
  const principal = Number(appRow.principal_cents)
  const loan = {
    id: lid,
    application_id: applicationId,
    status: loanStatus,
    principal_cents: principal,
    balance_cents: principal,
    product_code: appRow.product_code,
    term_months: appRow.term_months,
    funded_at: null,
    disbursed_at: null,
    funding_authorized_at: null,
  }
  loans.set(lid, loan)
  appRow.loan_id = lid
  return loan
}

v1.post('/loan-applications/:applicationId/underwriting/decision', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'IN_UNDERWRITING') {
    return sendError(
      req,
      res,
      409,
      'Application must be IN_UNDERWRITING for decision (current: ' +
        row.status +
        '). Call POST …/underwriting/start after credit-check.',
    )
  }
  const body = req.body || {}
  const outcome = String(body.outcome || '')
    .trim()
    .toUpperCase()
  if (!['APPROVE', 'CONDITIONAL', 'DECLINE'].includes(outcome)) {
    return sendError(req, res, 422, 'outcome must be APPROVE, CONDITIONAL, or DECLINE')
  }
  if (outcome === 'DECLINE') {
    row.status = 'DECLINED'
    row.decline_reason_code = body.decline_reason_code || 'UNDERWRITING_DECLINE'
    return res.json({ application: sanitizeApplicationOut(row), loan: null })
  }
  const stipsIn = Array.isArray(body.stipulations) ? body.stipulations : []
  if (outcome === 'CONDITIONAL' && stipsIn.length === 0) {
    return sendError(req, res, 422, 'CONDITIONAL requires at least one stipulation')
  }
  const needsStips = outcome === 'CONDITIONAL' || (outcome === 'APPROVE' && stipsIn.length > 0)
  if (needsStips) {
    if (stipsIn.length === 0) {
      return sendError(req, res, 422, 'APPROVE with stipulations requires stipulation items')
    }
    row.stipulations = stipsIn.map((item) => ({
      id: uuid(),
      description: item.description,
      fulfilled: false,
    }))
    row.status = 'APPROVED_CONDITIONAL'
    const loan = createLoanRecord(req.params.applicationId, row, 'PENDING_STIPS')
    return res.json({ application: sanitizeApplicationOut(row), loan })
  }
  row.status = 'APPROVED_CLEAR_TO_CLOSE'
  row.stipulations = []
  const loan = createLoanRecord(req.params.applicationId, row, 'PENDING_FUNDING')
  res.json({ application: sanitizeApplicationOut(row), loan })
})

v1.post('/loan-applications/:applicationId/stipulations/fulfill-all', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'APPROVED_CONDITIONAL') {
    return sendError(
      req,
      res,
      409,
      'fulfill-all is only valid while the application is APPROVED_CONDITIONAL (current: ' +
        row.status +
        '). With straight APPROVE, skip stip fulfillment and fund directly.',
    )
  }
  const loanId = row.loan_id
  if (!loanId) return sendError(req, res, 409, 'Application has no loan record')
  const loan = getLoanRow(loanId)
  if (!loan) return sendError(req, res, 404, 'Loan not found')
  if (loan.status !== 'PENDING_STIPS') {
    return sendError(req, res, 409, 'Loan is not waiting on stipulations')
  }
  if (row.stipulations.length === 0) {
    return sendError(req, res, 409, 'No stipulations on this application')
  }
  const hadOpen = row.stipulations.some((s) => !s.fulfilled)
  if (!hadOpen) {
    return sendError(req, res, 409, 'No outstanding stipulations to fulfill')
  }
  for (const s of row.stipulations) {
    s.fulfilled = true
  }
  row.status = 'APPROVED_CLEAR_TO_CLOSE'
  loan.status = 'PENDING_FUNDING'
  res.json({
    application: sanitizeApplicationOut(row),
    loan,
    fulfilled_stipulation_ids: row.stipulations.map((s) => s.id),
  })
})

v1.post('/loan-applications/:applicationId/stipulations/:stipulationId/fulfill', (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'APPROVED_CONDITIONAL') {
    return sendError(
      req,
      res,
      409,
      'Fulfill is only valid while the application is APPROVED_CONDITIONAL (current: ' +
        row.status +
        '). If you used straight APPROVE, skip fulfill. If stips are already cleared, status moves to APPROVED_CLEAR_TO_CLOSE — fund (book) then disburse (send proceeds).',
    )
  }
  const loanId = row.loan_id
  if (!loanId) {
    return sendError(req, res, 409, 'Application has no loan record')
  }
  const loan = getLoanRow(loanId)
  if (!loan) return sendError(req, res, 404, 'Loan not found')
  if (loan.status !== 'PENDING_STIPS') {
    return sendError(req, res, 409, 'Loan is not waiting on stipulations')
  }
  const stipId = req.params.stipulationId
  const stip = row.stipulations.find((s) => s.id === stipId)
  if (!stip) return sendError(req, res, 404, 'Stipulation not found')
  stip.fulfilled = true
  if (allStipulationsFulfilled(row.stipulations)) {
    row.status = 'APPROVED_CLEAR_TO_CLOSE'
    loan.status = 'PENDING_FUNDING'
  }
  res.json({ application: sanitizeApplicationOut(row), loan })
})

v1.get('/loans/:loanId', (req, res) => {
  const row = getLoanRow(req.params.loanId)
  if (!row) return sendError(req, res, 404, 'Loan not found')
  res.json({ ...row })
})

function executeFund(loanId) {
  const row = getLoanRow(loanId)
  if (!row) return { error: 404, detail: 'Loan not found' }
  if (row.status !== 'CLEARED_FOR_BOOKING') {
    return {
      error: 409,
      detail:
        'Loan must be CLEARED_FOR_BOOKING to fund (book on the ledger). Current: ' +
        row.status +
        '. When PENDING_FUNDING after clear-to-close, call POST .../funding/authorize first, then fund. When FUNDED, call POST .../disburse.',
    }
  }
  row.status = 'FUNDED'
  row.funded_at = todayISO()
  return { loan: row }
}

function executeDisburse(loanId) {
  const row = getLoanRow(loanId)
  if (!row) return { error: 404, detail: 'Loan not found' }
  if (row.status !== 'FUNDED') {
    return {
      error: 409,
      detail:
        'Loan must be FUNDED before disbursement (release proceeds to the borrower). Current: ' +
        row.status +
        '. Call POST .../fund first when status is CLEARED_FOR_BOOKING (after funding/authorize).',
    }
  }
  row.status = 'ACTIVE'
  row.disbursed_at = todayISO()
  return { loan: row }
}

/** Secondary control: funding desk / committee clears the loan to book (PENDING_FUNDING → CLEARED_FOR_BOOKING). */
v1.post('/loans/:loanId/funding/authorize', (req, res) => {
  const row = getLoanRow(req.params.loanId)
  if (!row) return sendError(req, res, 404, 'Loan not found')
  if (row.status !== 'PENDING_FUNDING') {
    return sendError(
      req,
      res,
      409,
      'funding/authorize requires PENDING_FUNDING (clear-to-close, stips satisfied). Current: ' +
        row.status,
    )
  }
  row.status = 'CLEARED_FOR_BOOKING'
  row.funding_authorized_at = todayISO()
  res.json(row)
})

v1.post('/loans/:loanId/fund', (req, res) => {
  const result = executeFund(req.params.loanId)
  if (result.error) return sendError(req, res, result.error, result.detail)
  res.json(result.loan)
})

v1.post('/loans/:loanId/disburse', (req, res) => {
  const result = executeDisburse(req.params.loanId)
  if (result.error) return sendError(req, res, result.error, result.detail)
  res.json(result.loan)
})

v1.get('/loans/:loanId/payment-schedule', (req, res) => {
  const loan = getLoanRow(req.params.loanId)
  if (!loan) return sendError(req, res, 404, 'Loan not found')
  const term = Number(loan.term_months)
  const principal = Number(loan.principal_cents)
  const per = term ? Math.floor(principal / term) : principal
  const remainder = term ? principal % term : 0
  const start = scheduleStartDate()
  const installments = []
  for (let i = 0; i < term; i++) {
    const p = per + (i === term - 1 ? remainder : 0)
    const interest = Math.max(0, Math.floor(p / 50))
    const due = new Date(start)
    due.setDate(due.getDate() + 32 * i)
    const capped = Math.min(due.getDate(), 28)
    due.setDate(capped)
    installments.push({
      installment_number: i + 1,
      due_date: due.toISOString().slice(0, 10),
      principal_cents: p,
      interest_cents: interest,
      total_due_cents: p + interest,
    })
  }
  res.json({
    loan_id: req.params.loanId,
    status: loan.status,
    term_months: term,
    original_principal_cents: principal,
    installments,
    note: 'Simplified mock schedule for demos only.',
  })
})

v1.post('/loans/:loanId/payments', (req, res) => {
  const row = getLoanRow(req.params.loanId)
  if (!row) return sendError(req, res, 404, 'Loan not found')
  const body = req.body || {}
  if (typeof body.amount_cents !== 'number' || body.amount_cents <= 0) {
    return sendError(req, res, 422, 'amount_cents must be > 0')
  }
  const rawMethod = body.method != null ? String(body.method).trim().toUpperCase() : 'ACH'
  const paymentMethod = PAYMENT_METHODS.includes(rawMethod) ? rawMethod : null
  if (!paymentMethod) {
    return sendError(
      req,
      res,
      422,
      'method must be a valid payment rail code: ' +
        PAYMENT_METHODS.join(', ') +
        ' (ACH = NACHA-style ACH; WIRE = domestic wire / Fedwire-style)',
    )
  }
  if (row.status !== 'ACTIVE') {
    return sendError(req, res, 409, 'Loan must be ACTIVE for payments')
  }
  const bal = row.balance_cents - body.amount_cents
  if (bal < 0) return sendError(req, res, 400, 'Payment exceeds balance')
  row.balance_cents = bal
  if (bal === 0) row.status = 'PAID_OFF'
  res.json({
    loan: row,
    payment_amount_cents: body.amount_cents,
    payment_method: paymentMethod,
  })
})

v1.post('/loans/:loanId/payoff', (req, res) => {
  const row = getLoanRow(req.params.loanId)
  if (!row) return sendError(req, res, 404, 'Loan not found')
  if (row.status === 'CLOSED') return res.json(row)
  if (row.balance_cents > 0) row.balance_cents = 0
  row.status = 'CLOSED'
  res.json(row)
})

app.use('/v1', v1)

const PORT = Number(process.env.PORT) || 8765
const HOST = process.env.HOST || '127.0.0.1'

const server = app.listen(PORT, HOST, () => {
  console.log('Mock loan API at http://' + HOST + ':' + PORT + ' (Swagger: /docs)')
})

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      'Port ' +
        PORT +
        ' is already in use on ' +
        HOST +
        '. Another mock server may still be running.\n' +
        '  • Stop it:  lsof -ti tcp:' +
        PORT +
        ' | xargs kill\n' +
        '  • Or use a different port:  PORT=8766 npm run start:mock\n' +
        '    (then set LOAN_API_BASE_URL=http://127.0.0.1:8766/v1 for tests)',
    )
    process.exit(1)
  }
  throw err
})
