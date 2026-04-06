import {
  ALLOWED_LOAN_TERM_MONTHS,
  PAYMENT_METHODS,
  STIPULATION_DESCRIPTION_EXAMPLES,
} from './loanConstants.js'

export { ALLOWED_LOAN_TERM_MONTHS, PAYMENT_METHODS, STIPULATION_DESCRIPTION_EXAMPLES }

/**
 * Example loan data you can reuse in tests or copy into Postman.
 * Amounts are in "cents" (e.g. 5_000_000 cents = $50,000.00 if your product uses USD cents).
 * **term_months** must be one of **ALLOWED_LOAN_TERM_MONTHS** on the mock API.
 */
export function buildSampleLoanApplication() {
  return {
    product_code: 'TERM_36',
    principal_cents: 5_000_000,
    term_months: 36,
    borrower: {
      full_name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      annual_income_cents: 12_000_000,
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
