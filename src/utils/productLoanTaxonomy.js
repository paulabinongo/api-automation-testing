/**
 * Top-level taxonomy on each **GET /reference/loan-products** row (**`product_loan_type`**).
 *
 * - **PERSONAL** — consumer / retail: unsecured Personal Loan, Home Loan, Car Loan, etc.
 * - **BUSINESS** — commercial only (e.g. Business / SME loans); not mixed with retail products.
 */
export const PRODUCT_LOAN_TYPE = Object.freeze({
  PERSONAL: 'PERSONAL',
  BUSINESS: 'BUSINESS',
})
