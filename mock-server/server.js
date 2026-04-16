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

import { PAYMENT_METHODS } from '../src/utils/loanConstants.js'
import {
  applicationRequiresMetrobankDepositAccountConfirmation,
  applyHomeLoanInternalFieldDefaults,
  applyHomeLoanPublicFormDefaults,
  buildLoanProductReferencePayload,
  METROBANK_DEPOSIT_REPAYMENT_PLAN,
  primaryIdUploadValuesForProduct,
  validateApplicationAgainstCatalog,
} from '../src/loanProductCatalog.js'
import { getLoanProductByCode } from '../src/loan-products/calculations/catalog.js'
import { computeLoanPreviewForProduct } from '../src/loan-products/calculations/computationRegistry.js'
import {
  PRODUCT_CODES_REQUIRING_DOCUMENT_INTAKE_BEFORE_SUBMIT,
  PRODUCT_CODES_WITH_METROBANK_DEPOSIT_CONFIRM,
  PRODUCT_CODES_WITH_PEP_COMPLIANCE_GATE,
} from '../src/loan-products/lifecyclePolicies.js'
import { evaluateEligibilityForProduct } from '../src/loan-products/calculations/registry.js'
import { computeMetrobankHomeLoanLifecyclePhase } from '../src/loan-products/types/home-loan/metrobankHomeLoanLifecyclePhase.js'
import {
  computeHomeLoanApplicationNonRefundableFees,
  hasValidHomeLoanBookingFeesRecorded,
  validateHomeLoanBookingFeesBody,
  validateHomeLoanDocumentsPostBody,
} from '../src/loan-products/types/home-loan/homeLoanLosValidation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const openApiSpec = JSON.parse(readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'))

const API_SEMANTIC_VERSION = openApiSpec.info.version
const BANK_ENV = process.env.BANK_API_ENV || 'sandbox'

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string | string[]} detail
 * @param {Record<string, unknown>} [extra] optional **Problem Details**-style fields (**type**, **title**, **retry_after_seconds**, …)
 */
function sendError(req, res, status, detail, extra) {
  /** @type {Record<string, unknown>} */
  const body = {
    detail,
    correlation_id: req.correlationId,
    timestamp: new Date().toISOString(),
  }
  if (extra != null && typeof extra === 'object') Object.assign(body, extra)
  res.status(status).json(body)
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

/** **POST** (body hash) and **DELETE** `/v1/loan-applications/{uuid}` (no body) when **Idempotency-Key** is set. */
function idempotencyForAuthedMutations(req, res, next) {
  const raw = req.headers['idempotency-key']
  if (raw == null || raw === '') return next()
  const idemKey = String(raw).trim().slice(0, 128)
  if (!idemKey) return next()
  const pathOnly = req.originalUrl.split('?')[0]
  const isPost = req.method === 'POST'
  const isDeleteDraft = req.method === 'DELETE' && /^\/v1\/loan-applications\/[^/]+$/.test(pathOnly)
  if (!isPost && !isDeleteDraft) return next()
  const bodyHash = isDeleteDraft ? '' : JSON.stringify(req.body ?? {})
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
    if (hit.status === 204 || hit.body === null) {
      return res.status(hit.status).end()
    }
    return res.status(hit.status).json(hit.body)
  }
  if (isDeleteDraft) {
    res.once('finish', () => {
      const code = res.statusCode
      if (code >= 200 && code < 300) {
        if (idemStore.size >= IDEM_MAX) {
          const first = idemStore.keys().next().value
          idemStore.delete(first)
        }
        idemStore.set(scopedKey, { bodyHash: '', status: code, body: null })
      }
    })
    return next()
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
app.set('json spaces', 2)
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

/** Minimum age (ms) before a **DRAFT** may be cancelled (**DELETE**) or system-removed. Override with **DRAFT_MIN_RETENTION_MS** (e.g. **100** in automated tests). Default **60000** (1 minute). */
function draftMinRetentionMs() {
  const raw = process.env.DRAFT_MIN_RETENTION_MS
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return 60_000
}

/** Default **DRAFT** system expiry — **3 minutes** (after **`draft_created_at`**), never before **draftMinRetentionMs()**. */
const DEFAULT_DRAFT_AUTO_CANCEL_MS = 180_000

/**
 * **DRAFT** rows are removed by the server after this age (≥ **draftMinRetentionMs()**).
 * Default **180000** ms (**3** minutes) when **`DRAFT_SYSTEM_CANCEL_AFTER_MS`** is unset.
 * Set to **0**, **false**, **off**, or **no** to disable automatic removal only.
 */
function systemDraftCancelAfterMs() {
  const raw = process.env.DRAFT_SYSTEM_CANCEL_AFTER_MS
  if (raw != null && String(raw).trim() !== '') {
    const token = String(raw).trim().toLowerCase()
    if (token === '0' || token === 'false' || token === 'off' || token === 'no') return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.max(draftMinRetentionMs(), n)
  }
  return Math.max(draftMinRetentionMs(), DEFAULT_DRAFT_AUTO_CANCEL_MS)
}

function shouldAutoRemoveDraft(row) {
  if (row.status !== 'DRAFT') return false
  const ttl = systemDraftCancelAfterMs()
  if (ttl == null) return false
  const bornMs = row.draft_created_at ? new Date(row.draft_created_at).getTime() : NaN
  if (!Number.isFinite(bornMs)) return false
  return Date.now() - bornMs >= ttl
}

function sweepAutoExpiredDrafts() {
  if (systemDraftCancelAfterMs() == null) return
  for (const [id, row] of applications) {
    if (shouldAutoRemoveDraft(row)) applications.delete(id)
  }
}

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
  if (shouldAutoRemoveDraft(row)) {
    applications.delete(applicationId)
    return null
  }
  return row
}

function getLoanRow(loanId) {
  const row = loans.get(loanId)
  if (!row) return null
  return row
}

/** Strip internal **owner_user_id** from API responses; add derived Metrobank Home Loan phase when applicable. */
function sanitizeApplicationOut(row) {
  if (!row || typeof row !== 'object') return row
  const { owner_user_id: _omit, ...rest } = row
  if (row.product_code === 'HOME_LOAN') {
    const loan = row.loan_id ? getLoanRow(row.loan_id) : null
    const phase = computeMetrobankHomeLoanLifecyclePhase(row, loan)
    if (phase) return { ...rest, metrobank_home_loan_lifecycle_phase: phase }
  }
  return rest
}

/** Echo **`metrobank_home_loan_lifecycle_phase`** on **HOME_LOAN** loan reads (same derivation as **ApplicationOut**). */
function enrichLoanOut(loan) {
  if (!loan || loan.product_code !== 'HOME_LOAN') return loan
  const app = loan.application_id ? getApp(loan.application_id) : null
  if (!app) return loan
  const phase = computeMetrobankHomeLoanLifecyclePhase(app, loan)
  if (!phase) return loan
  return { ...loan, metrobank_home_loan_lifecycle_phase: phase }
}

/** Step 6 PEP screening — **Yes** on either boolean flags heightened scrutiny (AML/CFT-style). */
function additionalInformationIndicatesPep(additional_information) {
  if (!additional_information || typeof additional_information !== 'object') return false
  return (
    additional_information.pep_close_family_or_public_position === true ||
    additional_information.pep_financial_transactions_on_behalf === true
  )
}

function applicationRequiresPepComplianceClearance(row) {
  return (
    PRODUCT_CODES_WITH_PEP_COMPLIANCE_GATE.has(row.product_code) &&
    additionalInformationIndicatesPep(row.additional_information)
  )
}

/** Rebuild intake body from a stored row (eligibility / validation). */
function applicationBodyFromRow(row) {
  return {
    product_code: row.product_code,
    principal_cents: row.principal_cents,
    term_months: row.term_months,
    metrobank_client_type: row.metrobank_client_type,
    loan_purpose: row.loan_purpose,
    additional_information: row.additional_information,
    borrower: row.borrower,
    employment: row.employment,
  }
}

/** @returns {string | null} error message if **APPROVE** / **CONDITIONAL** must be blocked */
function metrobankDepositPolicyBlocksApproval(row) {
  if (!PRODUCT_CODES_WITH_METROBANK_DEPOSIT_CONFIRM.has(row.product_code)) return null
  const mt = String(row.metrobank_client_type || '')
  if (mt === 'EXISTING_CLIENT_DEPOSIT_ACCOUNT') return null
  if (mt === 'NOT_METROBANK_CLIENT' || mt === 'EXISTING_CLIENT_CREDIT_CARD') {
    if (row.metrobank_deposit_account_confirmed_at) return null
    return 'Underwriting cannot approve until the borrower completes Metrobank deposit account opening for ADA repayments — POST /v1/loan-applications/{applicationId}/metrobank-deposit-account/confirm'
  }
  return 'Underwriting cannot approve: Metrobank deposit policy not satisfied for this application'
}

/** First of month after "today + ~1 month" — matches prior Python demo logic. */
function scheduleStartDate() {
  const d = new Date()
  let start = new Date(d.getFullYear(), d.getMonth(), 1)
  start.setDate(start.getDate() + 32)
  start = new Date(start.getFullYear(), start.getMonth(), 1)
  return start
}

function validateCreateBody(body, options) {
  return validateApplicationAgainstCatalog(body, options || {})
}

/** HOME_LOAN: merge Metrobank public-form defaults before catalogue validation. */
function normalizeLoanApplicationBody(body) {
  const raw = body && typeof body === 'object' ? body : {}
  if (raw.product_code === 'HOME_LOAN') return applyHomeLoanPublicFormDefaults(raw)
  return raw
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
  const productCodeRaw =
    req.query.product_code != null && String(req.query.product_code).trim() !== ''
      ? String(req.query.product_code)
      : 'PERSONAL_LOAN'
  const product = getLoanProductByCode(productCodeRaw)
  if (!product) {
    return sendError(req, res, 422, [
      `Unknown product_code "${productCodeRaw}" — use a code from GET /v1/reference/loan-products`,
    ])
  }
  const principalCents = req.query.principal_cents != null ? Number(req.query.principal_cents) : NaN
  const termMonths = req.query.term_months != null ? Number(req.query.term_months) : NaN
  const loanPurposeQ =
    req.query.loan_purpose != null && String(req.query.loan_purpose).trim() !== ''
      ? String(req.query.loan_purpose)
      : undefined
  let interestFixingYears = 1
  if (productCodeRaw === 'HOME_LOAN') {
    if (req.query.interest_fixing_years != null && String(req.query.interest_fixing_years).trim() !== '') {
      interestFixingYears = Number(req.query.interest_fixing_years)
    }
  }
  const errs = []
  if (!Number.isFinite(principalCents) || principalCents !== Math.round(principalCents)) {
    errs.push('principal_cents must be a whole number (PHP centavos)')
  } else if (
    (productCodeRaw === 'PERSONAL_LOAN' || productCodeRaw === 'HOME_LOAN') &&
    (!Number.isInteger(principalCents) || principalCents % 100 !== 0)
  ) {
    errs.push('principal_cents must be a whole PHP amount (integer centavos divisible by 100)')
  }
  const allowedTerms = product.allowed_term_months
  if (
    !Number.isFinite(termMonths) ||
    !Array.isArray(allowedTerms) ||
    !allowedTerms.includes(termMonths)
  ) {
    errs.push(
      'term_months must be one of: ' +
        (Array.isArray(allowedTerms) ? allowedTerms.join(', ') : '(see product catalogue)'),
    )
  }
  if (
    productCodeRaw === 'HOME_LOAN' &&
    req.query.interest_fixing_years != null &&
    String(req.query.interest_fixing_years).trim() !== '' &&
    (!Number.isInteger(interestFixingYears) || interestFixingYears < 1 || interestFixingYears > 5)
  ) {
    errs.push('interest_fixing_years must be an integer from 1 to 5 (HOME_LOAN initial fixing period)')
  }
  if (errs.length) return sendError(req, res, 422, errs)
  const minP = /** @type {number} */ (product.min_principal_cents)
  const maxP = /** @type {number} */ (product.max_principal_cents)
  if (principalCents < minP || principalCents > maxP) {
    return sendError(
      req,
      res,
      422,
      `principal_cents must be between ${minP} and ${maxP} (catalogue limits for ${productCodeRaw})`,
    )
  }
  const preview = computeLoanPreviewForProduct(productCodeRaw, principalCents, termMonths, {
    loan_purpose: loanPurposeQ,
    ...(productCodeRaw === 'HOME_LOAN' ? { interest_fixing_years: interestFixingYears } : {}),
  })
  if (!preview.ok) return sendError(req, res, 422, preview.errors)
  res.json(preview.payload)
}

/** Uses **principal_cents** and **term_months** from the borrower’s draft application (same session owner). */
function sendLoanComputationPreviewFromApplication(req, res) {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id != null && row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Not allowed to access this application')
  }
  const ai = row.additional_information && typeof row.additional_information === 'object' ? row.additional_information : {}
  let fixingYears = ai.interest_fixing_years != null ? Number(ai.interest_fixing_years) : 1
  if (!Number.isInteger(fixingYears) || fixingYears < 1 || fixingYears > 5) fixingYears = 1
  const preview = computeLoanPreviewForProduct(
    String(row.product_code),
    row.principal_cents,
    row.term_months,
    {
      loan_purpose: row.loan_purpose,
      ...(String(row.product_code) === 'HOME_LOAN' ? { interest_fixing_years: fixingYears } : {}),
    },
  )
  if (!preview.ok) return sendError(req, res, 422, preview.errors)
  res.json({ ...preview.payload, application_id: row.id })
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


// Apply authentication only to specific endpoints that need it
v1.post('/auth/logout', authRequired, (req, res) => {
  sessions.delete(req.accessToken)
  res.status(204).end()
})

v1.get('/auth/me', authRequired, (req, res) => {
  const k = req.bankSession.kyc
  res.json({
    user: { id: req.bankSession.user_id, email: req.bankSession.email },
    kyc_complete: Boolean(k && k.status === 'VERIFIED'),
    kyc_id: k?.kyc_id ?? null,
    kyc_status: k?.status ?? 'NOT_STARTED',
  })
})

v1.get('/onboarding/status', authRequired, (req, res) => {
  const k = req.bankSession.kyc
  res.json({
    kyc_complete: Boolean(k && k.status === 'VERIFIED'),
    kyc_id: k?.kyc_id ?? null,
    status: k?.status ?? 'NOT_STARTED',
  })
})

v1.post('/onboarding/kyc', authRequired, (req, res) => {
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

v1.post('/loan-applications', authRequired, (req, res) => {
  const k = req.bankSession.kyc
  if (!k || k.status !== 'VERIFIED') {
    return sendError(
      req,
      res,
      403,
      'Complete customer onboarding first: POST /v1/onboarding/kyc with a logged-in session, then create an application',
    )
  }
  const body = normalizeLoanApplicationBody(req.body)
  const errors = validateCreateBody(body)
  if (errors.length) {
    return sendError(req, res, 422, errors)
  }
  const elig = evaluateEligibilityForProduct(body)
  if (!elig.eligible) {
    return sendError(
      req,
      res,
      422,
      elig.failed_checks.map((c) => 'Eligibility: ' + c),
    )
  }
  const persisted = applyHomeLoanInternalFieldDefaults(body)
  const {
    product_code,
    principal_cents,
    term_months,
    borrower,
    metrobank_client_type,
    employment,
    loan_purpose,
    additional_information,
  } = persisted
  const aid = uuid()
  const row = {
    id: aid,
    status: 'DRAFT',
    product_code,
    principal_cents,
    term_months,
    metrobank_client_type,
    loan_purpose,
    additional_information:
      additional_information && typeof additional_information === 'object'
        ? { ...additional_information }
        : null,
    borrower: { ...borrower },
    employment: { ...employment },
    loan_id: null,
    stipulations: [],
    decline_reason_code: null,
    credit_reference_id: null,
    disclosures_acknowledged_at: null,
    pep_compliance_clearance_at: null,
    metrobank_deposit_account_confirmed_at: null,
    draft_created_at: new Date().toISOString(),
    owner_user_id: req.bankSession.user_id,
  }
  applications.set(aid, row)
  res.status(200).json(sanitizeApplicationOut(row))
})

v1.post('/loan-applications/eligibility-preview', authRequired, (req, res) => {
  const k = req.bankSession.kyc
  if (!k || k.status !== 'VERIFIED') {
    return sendError(
      req,
      res,
      403,
      'Complete customer onboarding first: POST /v1/onboarding/kyc with a logged-in session, then run eligibility preview',
    )
  }
  const body = normalizeLoanApplicationBody(req.body)
  const errors = validateCreateBody(body)
  if (errors.length) {
    return sendError(req, res, 422, errors)
  }
  const result = evaluateEligibilityForProduct(body)
  res.json({
    eligible: result.eligible,
    checks: result.checks,
    failed_checks: result.failed_checks,
  })
})

v1.patch('/loan-applications/:applicationId', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Application belongs to another session')
  }
  if (row.status !== 'DRAFT') {
    return sendError(req, res, 409, 'PATCH allowed only when application status is DRAFT')
  }
  const p = req.body && typeof req.body === 'object' ? req.body : {}
  const mergedAdditional =
    p.additional_information && typeof p.additional_information === 'object'
      ? {
          ...(row.additional_information && typeof row.additional_information === 'object'
            ? row.additional_information
            : {}),
          ...p.additional_information,
        }
      : row.additional_information
  const mergedBody = {
    product_code: p.product_code != null ? p.product_code : row.product_code,
    principal_cents: p.principal_cents != null ? p.principal_cents : row.principal_cents,
    term_months: p.term_months != null ? p.term_months : row.term_months,
    metrobank_client_type:
      p.metrobank_client_type != null ? p.metrobank_client_type : row.metrobank_client_type,
    loan_purpose: p.loan_purpose != null ? p.loan_purpose : row.loan_purpose,
    additional_information: mergedAdditional,
    borrower: {
      ...row.borrower,
      ...(p.borrower && typeof p.borrower === 'object' ? p.borrower : {}),
    },
    employment: {
      ...row.employment,
      ...(p.employment && typeof p.employment === 'object' ? p.employment : {}),
    },
  }
  const body = normalizeLoanApplicationBody(mergedBody)
  const errors = validateCreateBody(body, { personalLoanPrimaryIdPolicy: 'full' })
  if (errors.length) {
    return sendError(req, res, 422, errors)
  }
  const elig = evaluateEligibilityForProduct(body)
  if (!elig.eligible) {
    return sendError(
      req,
      res,
      422,
      elig.failed_checks.map((c) => 'Eligibility: ' + c),
    )
  }
  const persisted = applyHomeLoanInternalFieldDefaults(body)
  const oldPid = String(row.borrower?.primary_id_document_type || '')
  const newPid = String(persisted.borrower?.primary_id_document_type || '')
  if (row.document_intake?.completed_at && oldPid !== newPid) {
    delete row.document_intake
    delete row.home_loan_booking_fees
  }
  if (p.additional_information && typeof p.additional_information === 'object') {
    row.pep_compliance_clearance_at = null
    row.metrobank_deposit_account_confirmed_at = null
  }
  if (
    p.metrobank_client_type != null &&
    String(p.metrobank_client_type) !== String(row.metrobank_client_type)
  ) {
    row.metrobank_deposit_account_confirmed_at = null
  }
  Object.assign(row, {
    product_code: persisted.product_code,
    principal_cents: persisted.principal_cents,
    term_months: persisted.term_months,
    metrobank_client_type: persisted.metrobank_client_type,
    loan_purpose: persisted.loan_purpose,
    additional_information: persisted.additional_information,
    borrower: persisted.borrower,
    employment: persisted.employment,
  })
  res.json(sanitizeApplicationOut(row))
})

v1.post('/loan-applications/:applicationId/documents', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Application belongs to another session')
  }
  if (row.status !== 'DRAFT') {
    return sendError(
      req,
      res,
      409,
      'documents registration allowed only when application status is DRAFT',
    )
  }
  const body = req.body || {}
  const uploaded = body.primary_id_document_type
  if (uploaded == null || String(uploaded).trim() === '') {
    return sendError(req, res, 422, 'primary_id_document_type required')
  }
  const u = String(uploaded)
  const product = getLoanProductByCode(row.product_code)
  const allowedIdTypes = primaryIdUploadValuesForProduct(product)
  if (!allowedIdTypes.length) {
    return sendError(
      req,
      res,
      400,
      'Document upload is not configured for this product — add primary_id_document_types on the catalogue row',
    )
  }
  if (!allowedIdTypes.includes(u)) {
    return sendError(
      req,
      res,
      422,
      'primary_id_document_type must be one of: ' + allowedIdTypes.join(', '),
    )
  }
  const declared = row.borrower?.primary_id_document_type
  const d = declared != null ? String(declared) : ''
  if (u !== d) {
    return sendError(
      req,
      res,
      422,
      `primary_id_document_type at upload (${u}) must match borrower.primary_id_document_type (${d || 'none'}). Update the declared ID via PATCH or select the same ID type you declared in personal details.`,
    )
  }
  if (row.product_code === 'HOME_LOAN') {
    const losErrs = validateHomeLoanDocumentsPostBody(body, row)
    if (losErrs.length) {
      return sendError(req, res, 422, losErrs)
    }
    const region = String(body.home_loan_property_region).trim()
    const tc =
      body.home_loan_title_investigation_title_count != null
        ? Number(body.home_loan_title_investigation_title_count)
        : 1
    const feeSpec = computeHomeLoanApplicationNonRefundableFees(
      region === 'METRO_MANILA' ? 'METRO_MANILA' : 'OTHER',
      tc,
    )
    row.document_intake = {
      primary_id_document_type: u,
      completed_at: new Date().toISOString(),
      home_loan: {
        document_checklist: {
          ...(body.home_loan_document_checklist &&
          typeof body.home_loan_document_checklist === 'object'
            ? body.home_loan_document_checklist
            : {}),
        },
        property_region: feeSpec.property_region,
        title_investigation_title_count: feeSpec.title_investigation_title_count,
        application_fees: {
          appraisal_fee_cents: feeSpec.appraisal_fee_cents,
          title_investigation_cents: feeSpec.title_investigation_cents,
          verified_at: new Date().toISOString(),
        },
      },
    }
  } else {
    row.document_intake = {
      primary_id_document_type: u,
      completed_at: new Date().toISOString(),
    }
  }
  res.json(sanitizeApplicationOut(row))
})

/**
 * **Metrobank deposit for ADA** — for **`NOT_METROBANK_CLIENT`** or **`EXISTING_CLIENT_CREDIT_CARD`** with **`WILL_OPEN_METROBANK_DEPOSIT`**, after document registration. Sets **`metrobank_deposit_account_confirmed_at`** for **underwriting** approval (not a **submit** gate).
 */
v1.post('/loan-applications/:applicationId/metrobank-deposit-account/confirm', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Application belongs to another session')
  }
  const mbConfirmAllowed = new Set([
    'DRAFT',
    'SUBMITTED',
    'IN_PROCESSING',
    'CREDIT_COMPLETED',
    'IN_UNDERWRITING',
  ])
  if (!mbConfirmAllowed.has(row.status)) {
    return sendError(
      req,
      res,
      409,
      'Metrobank deposit confirmation allowed only before underwriting approval (status must be DRAFT, SUBMITTED, IN_PROCESSING, CREDIT_COMPLETED, or IN_UNDERWRITING)',
    )
  }
  if (!PRODUCT_CODES_WITH_METROBANK_DEPOSIT_CONFIRM.has(row.product_code)) {
    return sendError(
      req,
      res,
      400,
      'Metrobank deposit confirmation does not apply to this product_code',
    )
  }
  if (!applicationRequiresMetrobankDepositAccountConfirmation(row)) {
    return sendError(
      req,
      res,
      400,
      'Metrobank deposit confirmation is not required when metrobank_client_type is EXISTING_CLIENT_DEPOSIT_ACCOUNT (not NOT_METROBANK_CLIENT or EXISTING_CLIENT_CREDIT_CARD)',
    )
  }
  const plan = row.additional_information?.metrobank_deposit_repayment_plan
  if (plan !== METROBANK_DEPOSIT_REPAYMENT_PLAN.WILL_OPEN_METROBANK_DEPOSIT) {
    return sendError(
      req,
      res,
      409,
      'Metrobank deposit confirmation requires additional_information.metrobank_deposit_repayment_plan = "WILL_OPEN_METROBANK_DEPOSIT" (JSON string; declining or other-bank-only plans cannot proceed)',
    )
  }
  if (!(row.document_intake && row.document_intake.completed_at)) {
    return sendError(
      req,
      res,
      409,
      'Complete document registration (POST …/loan-applications/{applicationId}/documents) before Metrobank deposit confirmation',
    )
  }
  const intakeBody = applicationBodyFromRow(row)
  const elig = evaluateEligibilityForProduct(intakeBody)
  if (!elig.eligible) {
    return sendError(
      req,
      res,
      422,
      elig.failed_checks.map((c) => 'Eligibility: ' + c),
    )
  }
  row.metrobank_deposit_account_confirmed_at = new Date().toISOString()
  res.json(sanitizeApplicationOut(row))
})

/**
 * **PEP / enhanced due diligence gate** (production-shaped). After **Step 7** document registration,
 * **Personal Loan** applications with **either** Step 6 PEP boolean **true** must call this **before** **submit**.
 */
v1.post('/loan-applications/:applicationId/compliance/pep-clearance', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Application belongs to another session')
  }
  if (row.status !== 'DRAFT') {
    return sendError(
      req,
      res,
      409,
      'PEP compliance clearance allowed only when application status is DRAFT',
    )
  }
  if (!applicationRequiresPepComplianceClearance(row)) {
    return sendError(
      req,
      res,
      400,
      'PEP compliance clearance is not required — neither additional_information.pep_close_family_or_public_position nor pep_financial_transactions_on_behalf is true',
    )
  }
  if (!(row.document_intake && row.document_intake.completed_at)) {
    return sendError(
      req,
      res,
      409,
      'Complete document registration (POST …/loan-applications/{applicationId}/documents) before PEP compliance clearance',
    )
  }
  row.pep_compliance_clearance_at = new Date().toISOString()
  res.json(sanitizeApplicationOut(row))
})

/**
 * Borrower abandons a **DRAFT** — not allowed until the draft is at least **draftMinRetentionMs()** old.
 */
v1.delete('/loan-applications/:applicationId', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Application belongs to another session')
  }
  if (row.status !== 'DRAFT') {
    return sendError(
      req,
      res,
      409,
      'Only DRAFT applications can be cancelled this way — submitted files follow ops / decline flows',
    )
  }
  const bornMs = row.draft_created_at ? new Date(row.draft_created_at).getTime() : NaN
  const ageMs = Number.isFinite(bornMs) ? Date.now() - bornMs : Number.POSITIVE_INFINITY
  const minMs = draftMinRetentionMs()
  if (ageMs < minMs) {
    const policySec = Math.ceil(minMs / 1000)
    const waitSec = Math.max(1, Math.ceil((minMs - ageMs) / 1000))
    res.setHeader('Retry-After', String(waitSec))
    return sendError(
      req,
      res,
      409,
      `DRAFT applications cannot be cancelled until they are at least ${policySec} second(s) old (policy minimum retention)`,
      {
        type: 'urn:problem-type:draft-minimum-retention-not-satisfied',
        title: 'Draft minimum retention',
        retry_after_seconds: waitSec,
      },
    )
  }
  const aid = req.params.applicationId
  const uid = row.owner_user_id
  applications.delete(aid)
  console.info(
    '[audit] draft_cancelled',
    JSON.stringify({
      application_id: aid,
      user_id: uid,
      at: new Date().toISOString(),
    }),
  )
  res.status(204).end()
})

v1.get('/loan-applications/:applicationId', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  res.json(sanitizeApplicationOut(row))
})

v1.get(
  '/loan-applications/:applicationId/computation-preview',
  authRequired,
  sendLoanComputationPreviewFromApplication,
)

v1.post('/loan-applications/:applicationId/submit', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'DRAFT') {
    return sendError(req, res, 409, 'Invalid state for submit')
  }
  if (
    PRODUCT_CODES_REQUIRING_DOCUMENT_INTAKE_BEFORE_SUBMIT.has(row.product_code) &&
    !(row.document_intake && row.document_intake.completed_at)
  ) {
    return sendError(
      req,
      res,
      409,
      'Document intake required before submit: POST /v1/loan-applications/{applicationId}/documents with primary_id_document_type equal to borrower.primary_id_document_type',
    )
  }
  if (
    row.product_code === 'HOME_LOAN' &&
    !(
      row.document_intake &&
      row.document_intake.home_loan &&
      row.document_intake.home_loan.application_fees?.verified_at
    )
  ) {
    return sendError(
      req,
      res,
      409,
      'HOME_LOAN: complete LOS document checklist and application non-refundable fee lines via POST /v1/loan-applications/{applicationId}/documents (see OpenAPI: home_loan_document_checklist, home_loan_property_region, home_loan_application_fee_payments) before submit',
    )
  }
  if (applicationRequiresPepComplianceClearance(row) && !row.pep_compliance_clearance_at) {
    return sendError(
      req,
      res,
      409,
      'PEP heightened scrutiny: complete the compliance gate before submit — POST /v1/loan-applications/{applicationId}/compliance/pep-clearance (required when Step 6 indicates Yes to either PEP question). For a plain No/No PEP screening, this call is not used.',
    )
  }
  row.status = 'SUBMITTED'
  res.json(sanitizeApplicationOut(row))
})

/** LOS: processing / ops accepts the file into the working queue (after borrower submit). */
v1.post('/loan-applications/:applicationId/processing/accept', authRequired, (req, res) => {
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
v1.post('/loan-applications/:applicationId/disclosures/acknowledge', authRequired, (req, res) => {
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

v1.post('/loan-applications/:applicationId/credit-check', authRequired, (req, res) => {
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
v1.post('/loan-applications/:applicationId/underwriting/start', authRequired, (req, res) => {
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

v1.post('/loan-applications/:applicationId/underwriting/decision', authRequired, (req, res) => {
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
  const mbBlock = metrobankDepositPolicyBlocksApproval(row)
  if (mbBlock) {
    return sendError(req, res, 422, mbBlock)
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
    return res.json({ application: sanitizeApplicationOut(row), loan: enrichLoanOut(loan) })
  }
  row.status = 'APPROVED_CLEAR_TO_CLOSE'
  row.stipulations = []
  const loan = createLoanRecord(req.params.applicationId, row, 'PENDING_FUNDING')
  res.json({ application: sanitizeApplicationOut(row), loan: enrichLoanOut(loan) })
})

v1.post('/loan-applications/:applicationId/stipulations/fulfill-all', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'APPROVED_CONDITIONAL') {
    return sendError(
      req,
      res,
      409,
      'fulfill-all is only valid while application is APPROVED_CONDITIONAL (current: ' +
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
    loan: enrichLoanOut(loan),
    fulfilled_stipulation_ids: row.stipulations.map((s) => s.id),
  })
})

v1.post('/loan-applications/:applicationId/stipulations/:stipulationId/fulfill', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.status !== 'APPROVED_CONDITIONAL') {
    return sendError(
      req,
      res,
      409,
      'Fulfill is only valid while application is APPROVED_CONDITIONAL (current: ' +
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
  res.json({ application: sanitizeApplicationOut(row), loan: enrichLoanOut(loan) })
})

/**
 * **HOME_LOAN** — record post-approval booking fee lines (handling, notarial, DST / MRI / property insurance acknowledgements)
 * before **POST /v1/loans/{loanId}/funding/authorize**. Amounts must match **`GET /reference/loan-products`** → **fees_and_charges.after_approval**.
 */
v1.post('/loan-applications/:applicationId/home-loan/fees/booking', authRequired, (req, res) => {
  const row = getApp(req.params.applicationId)
  if (!row) return sendError(req, res, 404, 'Application not found')
  if (row.owner_user_id !== req.bankSession.user_id) {
    return sendError(req, res, 403, 'Application belongs to another session')
  }
  if (row.product_code !== 'HOME_LOAN') {
    return sendError(req, res, 400, 'This endpoint applies only to product_code HOME_LOAN')
  }
  if (!row.loan_id) {
    return sendError(
      req,
      res,
      409,
      'No loan on file — run underwriting decision (APPROVE or CONDITIONAL) first',
    )
  }
  const loan = getLoanRow(row.loan_id)
  if (!loan || loan.status !== 'PENDING_FUNDING') {
    return sendError(
      req,
      res,
      409,
      'HOME_LOAN booking fees: loan must be PENDING_FUNDING (clear-to-close after underwriting). Complete stipulations first if CONDITIONAL.',
    )
  }
  const okStatus = new Set(['APPROVED_CLEAR_TO_CLOSE', 'APPROVED_CONDITIONAL'])
  if (!okStatus.has(row.status)) {
    return sendError(
      req,
      res,
      409,
      'Application must be APPROVED_CLEAR_TO_CLOSE or APPROVED_CONDITIONAL',
    )
  }
  const body = req.body || {}
  const berr = validateHomeLoanBookingFeesBody(body)
  if (berr.length) return sendError(req, res, 422, berr)
  row.home_loan_booking_fees = {
    handling_fee_cents: Number(body.handling_fee_cents),
    notarial_document_count: Number(body.notarial_document_count),
    notarial_fee_cents: Number(body.notarial_fee_cents),
    dst_acknowledged: true,
    mri_insurance_acknowledged: true,
    property_insurance_acknowledged: true,
    recorded_at: new Date().toISOString(),
  }
  res.json(sanitizeApplicationOut(row))
})

v1.get('/loans/:loanId', authRequired, (req, res) => {
  const row = getLoanRow(req.params.loanId)
  if (!row) return sendError(req, res, 404, 'Loan not found')
  res.json(enrichLoanOut(row))
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
v1.post('/loans/:loanId/funding/authorize', authRequired, (req, res) => {
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
  if (row.product_code === 'HOME_LOAN') {
    const appRow = row.application_id ? getApp(row.application_id) : null
    if (!appRow || !hasValidHomeLoanBookingFeesRecorded(appRow.home_loan_booking_fees)) {
      return sendError(
        req,
        res,
        422,
        'HOME_LOAN: record booking fee lines via POST /v1/loan-applications/{applicationId}/home-loan/fees/booking (handling, notarial, DST, MRI, property insurance acknowledgements) before funding/authorize',
      )
    }
  }
  row.status = 'CLEARED_FOR_BOOKING'
  row.funding_authorized_at = todayISO()
  res.json(enrichLoanOut(row))
})

v1.post('/loans/:loanId/fund', authRequired, (req, res) => {
  const result = executeFund(req.params.loanId)
  if (result.error) return sendError(req, res, result.error, result.detail)
  res.json(enrichLoanOut(result.loan))
})

v1.post('/loans/:loanId/disburse', authRequired, (req, res) => {
  const result = executeDisburse(req.params.loanId)
  if (result.error) return sendError(req, res, result.error, result.detail)
  res.json(enrichLoanOut(result.loan))
})

v1.get('/loans/:loanId/payment-schedule', authRequired, (req, res) => {
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

v1.post('/loans/:loanId/payments', authRequired, (req, res) => {
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
    loan: enrichLoanOut(row),
    payment_amount_cents: body.amount_cents,
    payment_method: paymentMethod,
  })
})

v1.post('/loans/:loanId/payoff', authRequired, (req, res) => {
  const row = getLoanRow(req.params.loanId)
  if (!row) return sendError(req, res, 404, 'Loan not found')
  if (row.status === 'CLOSED') return res.json(enrichLoanOut(row))
  if (row.balance_cents > 0) row.balance_cents = 0
  row.status = 'CLOSED'
  res.json(enrichLoanOut(row))
})

app.use('/v1', v1)

const PORT = Number(process.env.PORT) || 8765
const HOST = process.env.HOST || '127.0.0.1'

const server = app.listen(PORT, HOST, () => {
  console.log('Mock loan API at http://' + HOST + ':' + PORT + ' (Swagger: /docs)')
  if (systemDraftCancelAfterMs() != null) {
    const every = Math.min(60_000, systemDraftCancelAfterMs() || 60_000)
    const sweepTimer = setInterval(sweepAutoExpiredDrafts, every)
    if (typeof sweepTimer.unref === 'function') sweepTimer.unref()
  }
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
