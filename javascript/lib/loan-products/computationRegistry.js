/**
 * Maps **`product_code`** → payment / fee preview builder. **`GET …/loan-computation-preview`**
 * and per-application preview use this registry so each catalogue can ship its own math module.
 */

import { computeHomeLoanPreview } from './home-loan/homeLoanComputation.js'
import { computePersonalLoanPreview } from './personal-loan/personalLoanComputation.js'

/** @type {Readonly<Record<string, (principalCents: number, termMonths: number, options?: object) => object | null>>} */
export const COMPUTATION_BY_PRODUCT_CODE = Object.freeze({
  PERSONAL_LOAN: computePersonalLoanPreview,
  HOME_LOAN: computeHomeLoanPreview,
})

/**
 * @param {string} productCode
 * @param {number} principalCents
 * @param {number} termMonths
 * @param {{ loan_purpose?: string }} [computationOptions] — **HOME_LOAN** uses **loan_purpose** for Home Equity rate tier
 * @returns {{ ok: true, payload: object } | { ok: false, errors: string[] }}
 */
export function computeLoanPreviewForProduct(
  productCode,
  principalCents,
  termMonths,
  computationOptions = {},
) {
  const fn = COMPUTATION_BY_PRODUCT_CODE[productCode]
  if (!fn) {
    return {
      ok: false,
      errors: [
        `No loan computation registered for product_code "${productCode}" — add it in javascript/lib/loan-products/computationRegistry.js (COMPUTATION_BY_PRODUCT_CODE)`,
      ],
    }
  }
  const payload = fn(principalCents, termMonths, computationOptions)
  if (!payload) {
    return { ok: false, errors: ['Unsupported term_months for computation'] }
  }
  return { ok: true, payload }
}
