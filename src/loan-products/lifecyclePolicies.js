/**
 * Declares which **mock-server** gates apply per **`product_code`**. When you add a product,
 * opt it into the sets that match its origination rules (see **`add-product-checklist.md`**).
 */

/** **POST …/documents** must complete before **submit** (Step 7–style ID upload). */
export const PRODUCT_CODES_REQUIRING_DOCUMENT_INTAKE_BEFORE_SUBMIT = Object.freeze(
  new Set(['PERSONAL_LOAN', 'HOME_LOAN']),
)

/** Step 6 PEP booleans → **POST …/compliance/pep-clearance** before **submit** when flagged. */
export const PRODUCT_CODES_WITH_PEP_COMPLIANCE_GATE = Object.freeze(
  new Set(['PERSONAL_LOAN', 'HOME_LOAN']),
)

/** **POST …/metrobank-deposit-account/confirm** (ADA) applies to these products only. */
export const PRODUCT_CODES_WITH_METROBANK_DEPOSIT_CONFIRM = Object.freeze(
  new Set(['PERSONAL_LOAN', 'HOME_LOAN']),
)
