import {
  ALLOWED_LOAN_TERM_MONTHS,
  PAYMENT_METHODS,
  STIPULATION_DESCRIPTION_EXAMPLES,
} from './loanConstants.js'

export { ALLOWED_LOAN_TERM_MONTHS, PAYMENT_METHODS, STIPULATION_DESCRIPTION_EXAMPLES }

/**
 * Example loan application — **PERSONAL_LOAN**, **PHP centavos** (see **GET /v1/reference/loan-products**).
 * **term_months** must be **12 | 18 | 24 | 36**.
 */
export function buildSampleLoanApplication() {
  return buildPersonalLoanSampleApplication(36)
}

/**
 * **PERSONAL_LOAN** sample — **principal_cents** / **annual_income_cents** are **PHP centavos** (≥ PHP 250,000 income).
 * Principal within **PHP 20,000**–**2,000,000**.
 * @param {number} [termMonths=36] one of **12 | 18 | 24 | 36**
 */
export function buildPersonalLoanSampleApplication(termMonths = 36) {
  return {
    product_code: 'PERSONAL_LOAN',
    principal_cents: 50_000_000,
    term_months: termMonths,
    borrower: {
      full_name: 'Maria Santos',
      email: 'maria.santos@example.com',
      annual_income_cents: 40_000_000,
    },
  }
}

/** Tell the practice (mock) credit check to pass — good for happy-path demos. */
export const creditCheckForcePass = { force_outcome: 'PASS' }

/** Tell the practice credit check to fail — good for decline demos. */
export const creditCheckForceFail = { force_outcome: 'FAIL' }

/** Straight approval with no extra document requests. */
export const underwritingStraightApprove = { outcome: 'APPROVE' }

/**
 * @param {number} amountCents
 * @param {'ACH' | 'WIRE'} [method] servicing rail — must be in **PAYMENT_METHODS**
 */
export function buildPaymentBody(amountCents, method = 'ACH') {
  return { amount_cents: amountCents, method }
}

/**
 * @param {'APPROVE' | 'CONDITIONAL' | 'DECLINE'} outcome
 * @param {{ description: string }[]} [stipulations]
 */
export function buildUnderwritingBody(outcome, stipulations) {
  const body = { outcome }
  if (stipulations?.length) body.stipulations = stipulations
  return body
}

/**
 * CONDITIONAL underwriting using the first **n** strings from **STIPULATION_DESCRIPTION_EXAMPLES** (demos only).
 * @param {number} [count=3]
 */
export function buildConditionalUnderwritingExample(count = 3) {
  const n = Math.min(Math.max(1, count), STIPULATION_DESCRIPTION_EXAMPLES.length)
  const stips = STIPULATION_DESCRIPTION_EXAMPLES.slice(0, n).map((description) => ({ description }))
  return buildUnderwritingBody('CONDITIONAL', stips)
}

/** Sandbox login — password must be `demo` or `demo123` on the mock server. */
export function buildDemoLogin(email = 'demo.borrower@loan.bank') {
  return { email, password: 'demo' }
}

/** KYC payload for POST /v1/onboarding/kyc (aligned with sample borrower). */
export function buildDemoKycPayload(overrides = {}) {
  return {
    full_name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    date_of_birth: '1992-06-15',
    national_id_last4: '4567',
    ...overrides,
  }
}
