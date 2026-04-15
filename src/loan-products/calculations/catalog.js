/**
 * Stable import path for catalogue lookups. New **`product_code`** values appear here
 * automatically when you add them to **`LOAN_PRODUCTS_BY_CODE`** in **`loanProductCatalog.js`**.
 */

import { LOAN_PRODUCTS_BY_CODE } from '../../loanProductCatalog.js'

export { LOAN_PRODUCTS_BY_CODE }

/**
 * @param {unknown} code
 * @returns {Readonly<Record<string, unknown>> & { product_code?: string } | undefined}
 */
export function getLoanProductByCode(code) {
  if (code == null || code === '') return undefined
  return LOAN_PRODUCTS_BY_CODE[String(code)]
}

/** Registered **`product_code`** strings (same keys as **GET /v1/reference/loan-products**). */
export function registeredLoanProductCodes() {
  return Object.freeze([...Object.keys(LOAN_PRODUCTS_BY_CODE)])
}
