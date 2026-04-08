/**
 * Origination + servicing LOVs shared by the mock API, OpenAPI examples, and tests.
 * Terms = union of **term_months** across all products (**GET /v1/reference/loan-products**); payment methods = servicing rails.
 */
import { ALL_CATALOG_TERM_MONTHS } from './loanProductCatalog.js'

export const ALLOWED_LOAN_TERM_MONTHS = ALL_CATALOG_TERM_MONTHS

/** Uppercase codes posted on POST …/payments */
export const PAYMENT_METHODS = Object.freeze(['ACH', 'WIRE'])

/**
 * Suggested `description` values for CONDITIONAL underwriting **`stipulations[]`**.
 * The mock does **not** validate against this list — any string you send is stored as-is.
 * Listed in **docs/DOCUMENTATION.md** §5.2 for copy-paste (demos, screen-reader friendly lookup).
 */
export const STIPULATION_DESCRIPTION_EXAMPLES = Object.freeze([
  // Income & employment
  'Proof of income (W-2)',
  'Most recent pay stub (last 30 days)',
  'Two most recent years federal tax returns',
  'Employment verification letter',
  'Year-to-date profit and loss (self-employed)',
  'Business bank statements (12 months)',
  // Identity & credit file
  'Government-issued photo ID',
  'Proof of Social Security number',
  'Proof of legal name change',
  'Letter of explanation for credit inquiry',
  'Bankruptcy discharge or dismissal papers',
  // Assets & source of funds
  'Two months complete bank statements (all pages)',
  'Gift letter and donor evidence of funds',
  'Letter of explanation for large deposits',
  // Property / collateral (when applicable)
  'Executed purchase agreement or sales contract',
  'Homeowners insurance binder or declarations page',
  'Flood insurance declarations (if required)',
  'HOA contact information and dues statement',
  'Preliminary title report or title commitment',
  // Disclosures & regulatory
  'Signed Loan Estimate',
  'Signed Closing Disclosure',
  'Signed initial loan disclosure package',
  'Electronic consent / eSign acknowledgment',
  // Insurance & secured products
  'Collateral insurance binder',
  'Vehicle insurance declarations (auto-secured)',
  // Legal / household
  'Divorce decree or separation agreement',
  'Child support order or payment history',
  'Current lease agreement (rental income)',
  'Power of attorney (if signing by representative)',
  'Trust documentation (if title held in trust)',
])
