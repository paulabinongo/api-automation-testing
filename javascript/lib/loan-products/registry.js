/**
 * Registers **per-product** behavior that is not purely data on **`LOAN_PRODUCTS_BY_CODE`**.
 * Add a new **`product_code`** here when you implement **`evaluateXEligibility`** (and register the product object in **`loanProductCatalog.js`**).
 */

import { evaluateHomeLoanEligibility } from './home-loan/homeLoanEligibility.js'
import { evaluatePersonalLoanEligibility } from './personal-loan/personalLoanEligibility.js'

/** @typedef {ReturnType<typeof evaluatePersonalLoanEligibility>} EligibilityResult */

/** @type {Readonly<Record<string, (body: object, options?: { referenceDate?: Date }) => EligibilityResult>>} */
export const ELIGIBILITY_BY_PRODUCT_CODE = Object.freeze({
  PERSONAL_LOAN: evaluatePersonalLoanEligibility,
  HOME_LOAN: evaluateHomeLoanEligibility,
})

/**
 * @param {unknown} body — same shape as **POST /loan-applications**
 * @param {{ referenceDate?: Date }} [options]
 * @returns {EligibilityResult}
 */
export function evaluateEligibilityForProduct(body, options = {}) {
  if (!body || typeof body !== 'object' || body.product_code == null || body.product_code === '') {
    return {
      eligible: false,
      checks: [],
      failed_checks: ['Valid application body with product_code required for eligibility'],
    }
  }
  const code = String(body.product_code)
  const fn = ELIGIBILITY_BY_PRODUCT_CODE[code]
  if (!fn) {
    return {
      eligible: false,
      checks: [],
      failed_checks: [
        `No eligibility evaluator registered for product_code "${code}" — add it in javascript/lib/loan-products/registry.js (ELIGIBILITY_BY_PRODUCT_CODE)`,
      ],
    }
  }
  return fn(body, options)
}
