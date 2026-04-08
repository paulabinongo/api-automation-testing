/**
 * Loan API helper — sends the same requests a browser or app would send.
 * Each method name describes the business step in plain English.
 */
import { randomUUID } from 'node:crypto'

import { getSettings } from './config.js'

export class LoanApiError extends Error {
  /** @param {string} message */
  constructor(message, statusCode, body) {
    super(message)
    this.name = 'LoanApiError'
    this.statusCode = statusCode
    this.body = body
  }
}

export class LoanApiClient {
  /**
   * @param {{ baseUrl?: string, apiKey?: string | null, timeoutMs?: number }} [options]
   */
  constructor(options = {}) {
    const env = getSettings()
    this.baseUrl = options.baseUrl ?? env.baseUrl
    this.apiKey = options.apiKey !== undefined ? options.apiKey : env.apiKey
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {RequestInit} [extra]
   * @param {{ auth?: boolean, idempotencyKey?: string }} [options] pass `{ auth: false }` for login (no Bearer)
   */
  async _request(method, path, extra = {}, options = {}) {
    const useAuth = options.auth !== false
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const { headers: extraHeaders = {}, ...rest } = extra
    /** @type {HeadersInit} */
    const headers = { Accept: 'application/json', ...extraHeaders }
    const corr =
      (extraHeaders['X-Correlation-Id'] || extraHeaders['x-correlation-id']) ?? randomUUID()
    headers['X-Correlation-Id'] = String(corr)
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = String(options.idempotencyKey).slice(0, 128)
    }
    if (useAuth && this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), this.timeoutMs)

    let response
    try {
      response = await fetch(url, {
        ...rest,
        method,
        headers,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(t)
    }

    const contentType = response.headers.get('content-type') || ''
    /** @type {unknown} */
    let data
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      throw new LoanApiError(`${method} ${path} failed: ${response.status}`, response.status, data)
    }
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  }

  /** @param {string | null} token from `login().access_token` */
  setAccessToken(token) {
    this.apiKey = token
  }

  /** Liveness and build metadata (no auth). */
  getHealth() {
    return this._request('GET', '/health', {}, { auth: false })
  }

  /** Product catalogue snapshot — terms, limits (no auth). */
  getLoanProductReference() {
    return this._request('GET', '/reference/loan-products', {}, { auth: false })
  }

  /**
   * Add-on interest preview + EIR — **principal_cents** / **term_months** (no auth).
   * @param {{ principal_cents: number, term_months: number }} q
   */
  getLoanComputationPreview(q) {
    const qs = new URLSearchParams({
      principal_cents: String(q.principal_cents),
      term_months: String(q.term_months),
    })
    return this._request('GET', `/reference/loan-computation-preview?${qs}`, {}, { auth: false })
  }

  /**
   * Payment preview from the borrower’s application — uses **principal_cents** and **term_months** on file (auth).
   * Response matches **getLoanComputationPreview** plus **application_id**.
   * @param {string} applicationId
   */
  getLoanComputationPreviewForApplication(applicationId) {
    return this._request(
      'GET',
      `/loan-applications/${encodeURIComponent(applicationId)}/computation-preview`,
    )
  }

  /** Demo sandbox: any email with password `demo` or `demo123`. */
  login(payload) {
    return this._request(
      'POST',
      '/auth/login',
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { auth: false },
    )
  }

  /** Ends the session; token is invalid afterward. */
  logout() {
    return this._request('POST', '/auth/logout')
  }

  /** Who is logged in and whether KYC is complete. */
  getAuthProfile() {
    return this._request('GET', '/auth/me')
  }

  /** KYC / customer onboarding status for the current session. */
  getOnboardingStatus() {
    return this._request('GET', '/onboarding/status')
  }

  /** Submit KYC — required once per session before `createApplication`. */
  completeKyc(payload) {
    return this._request('POST', '/onboarding/kyc', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /**
   * Start a new loan application (saved as a draft).
   * @param {object} payload
   * @param {{ idempotencyKey?: string }} [opts] banks require **Idempotency-Key** on create in production
   */
  createApplication(payload, opts = {}) {
    return this._request(
      'POST',
      '/loan-applications',
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { idempotencyKey: opts.idempotencyKey },
    )
  }

  /**
   * Dry-run Personal Loan eligibility (Step 6 **Next**) — same validation as create, no persistence.
   * Response: **eligible**, **checks**, **failed_checks**.
   */
  previewApplicationEligibility(payload) {
    return this._request('POST', '/loan-applications/eligibility-preview', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /** Update a **DRAFT** application (merged fields; catalogue + eligibility re-validated). */
  updateDraftApplication(applicationId, payload) {
    return this._request('PATCH', `/loan-applications/${applicationId}`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /**
   * Step 7 — **`primary_id_document_type`** must match **borrower.primary_id_document_type** (**422** if not).
   * Use the **same** LOV as Step 3: **GET /reference/loan-products** → **primary_id_document_types**. Required before **submit** for **PERSONAL_LOAN**.
   */
  registerApplicationDocuments(applicationId, payload) {
    return this._request('POST', `/loan-applications/${applicationId}/documents`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /**
   * **PEP enhanced due diligence** gate — mirrors Compliance sign-off after intake when Step 6 indicates **Yes**.
   * Call **after** **POST …/documents** and **before** **submit** when either **`additional_information`** PEP boolean is **true**.
   * **400** if PEP screening is both **false**; **409** if documents are not registered yet.
   */
  completePepComplianceClearance(applicationId) {
    return this._request('POST', `/loan-applications/${applicationId}/compliance/pep-clearance`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  }

  /**
   * **Metrobank deposit for ADA** — after **POST …/documents**, when **`metrobank_client_type`** is **`NOT_METROBANK_CLIENT`** or **`EXISTING_CLIENT_CREDIT_CARD`** with **`WILL_OPEN_METROBANK_DEPOSIT`**. Allowed while status is **DRAFT**, **SUBMITTED**, **IN_PROCESSING**, **CREDIT_COMPLETED**, or **IN_UNDERWRITING** (before a successful approval decision). Sets **`metrobank_deposit_account_confirmed_at`** (required for **underwriting** **APPROVE** / **CONDITIONAL**; **submit** does not require this call). Re-runs eligibility (**422** if capacity-to-pay checks fail). **400** if not applicable.
   */
  confirmMetrobankDepositAccount(applicationId) {
    return this._request(
      'POST',
      `/loan-applications/${applicationId}/metrobank-deposit-account/confirm`,
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
  }

  /** Look up one application by id. */
  getApplication(applicationId) {
    return this._request('GET', `/loan-applications/${applicationId}`)
  }

  /**
   * Abandon a **DRAFT** (**DELETE**). **409** if the draft is younger than the server’s minimum retention (default **60** seconds).
   * @returns {Promise<Record<string, never>>} empty object on **204**
   */
  cancelDraftApplication(applicationId) {
    return this._request('DELETE', `/loan-applications/${applicationId}`)
  }

  /** Borrower or officer submits the application for processing. */
  submitApplication(applicationId) {
    return this._request('POST', `/loan-applications/${applicationId}/submit`)
  }

  /** LOS: processing accepts the application into the working queue (SUBMITTED → IN_PROCESSING). */
  acceptForProcessing(applicationId) {
    return this._request('POST', `/loan-applications/${applicationId}/processing/accept`)
  }

  /** Initial disclosure package acknowledged (required before credit in this mock). */
  acknowledgeDisclosures(applicationId, payload = {}) {
    return this._request('POST', `/loan-applications/${applicationId}/disclosures/acknowledge`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /** Credit review step (sandbox can force pass/fail). */
  runCreditCheck(applicationId, payload = {}) {
    return this._request('POST', `/loan-applications/${applicationId}/credit-check`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /** Move application into the underwriting queue (CREDIT_COMPLETED → IN_UNDERWRITING). */
  startUnderwriting(applicationId) {
    return this._request('POST', `/loan-applications/${applicationId}/underwriting/start`)
  }

  /** Underwriter decision: approve, conditional (needs documents), or decline. */
  underwritingDecision(applicationId, payload) {
    return this._request('POST', `/loan-applications/${applicationId}/underwriting/decision`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /** Mark a stipulation (extra document request) as satisfied. */
  fulfillStipulation(applicationId, stipulationId) {
    return this._request(
      'POST',
      `/loan-applications/${applicationId}/stipulations/${stipulationId}/fulfill`,
    )
  }

  /** Mark every outstanding stipulation satisfied in one call (CONDITIONAL path only). */
  fulfillAllStipulations(applicationId) {
    return this._request('POST', `/loan-applications/${applicationId}/stipulations/fulfill-all`)
  }

  /** Read current loan details (balance, status, etc.). */
  getLoan(loanId) {
    return this._request('GET', `/loans/${loanId}`)
  }

  /** Preview payment dates and amounts (illustrative in the mock API). */
  getPaymentSchedule(loanId) {
    return this._request('GET', `/loans/${loanId}/payment-schedule`)
  }

  /** Funding desk / secondary approval (PENDING_FUNDING → CLEARED_FOR_BOOKING). Required before fund. */
  authorizeFunding(loanId) {
    return this._request('POST', `/loans/${loanId}/funding/authorize`)
  }

  /** Book the loan on the bank's books (CLEARED_FOR_BOOKING → FUNDED). Call disburse next to pay the borrower. */
  fundLoan(loanId) {
    return this._request('POST', `/loans/${loanId}/fund`)
  }

  /** Send proceeds to the borrower (FUNDED → ACTIVE). Requires fund first. */
  disburseLoan(loanId) {
    return this._request('POST', `/loans/${loanId}/disburse`)
  }

  /**
   * Post a payment toward the balance.
   * @param {{ idempotencyKey?: string }} [opts]
   */
  recordPayment(loanId, payload, opts = {}) {
    return this._request(
      'POST',
      `/loans/${loanId}/payments`,
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { idempotencyKey: opts.idempotencyKey },
    )
  }

  /** Close the loan after it is paid off (or as a final system step). */
  payoffLoan(loanId) {
    return this._request('POST', `/loans/${loanId}/payoff`)
  }
}
