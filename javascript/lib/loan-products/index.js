/**
 * Public entry for **`loan-products/`** — catalogue lookups, eligibility registry,
 * computation preview registry, and lifecycle policy sets. Add new **`product_code`**
 * behaviour in **`registry.js`** / **`computationRegistry.js`** after defining the
 * product in **`../loanProductCatalog.js`** (or a product-local catalogue module).
 */

export {
  LOAN_PRODUCTS_BY_CODE,
  getLoanProductByCode,
  registeredLoanProductCodes,
} from './catalog.js'
export { ELIGIBILITY_BY_PRODUCT_CODE, evaluateEligibilityForProduct } from './registry.js'
export {
  COMPUTATION_BY_PRODUCT_CODE,
  computeLoanPreviewForProduct,
} from './computationRegistry.js'
export {
  PRODUCT_CODES_REQUIRING_DOCUMENT_INTAKE_BEFORE_SUBMIT,
  PRODUCT_CODES_WITH_PEP_COMPLIANCE_GATE,
  PRODUCT_CODES_WITH_METROBANK_DEPOSIT_CONFIRM,
} from './lifecyclePolicies.js'
