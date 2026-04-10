/**
 * **Home Loan** catalogue (residential mortgage; PHP) — reference payload + purpose/LTV/term rules.
 * Package: **`javascript/lib/loan-products/home-loan/`**. Intake merge validation in **`../../loanProductCatalog.js`**; eligibility in **`./homeLoanEligibility.js`**.
 */

import { PH_ADDRESS_VALID_ROWS } from '../../philippineAddressReference.js'

function phpToCentavos(pesos) {
  return Math.round(pesos * 100)
}

export const HOME_LOAN_APPLICANT_CATEGORIES = Object.freeze(['RESIDENT', 'OFW'])

/** Government-issued IDs accepted for **Home Loan** (Passport preferred). */
export const HOME_LOAN_PRIMARY_ID_DOCUMENT_TYPES = Object.freeze([
  'PHILID',
  'PASSPORT',
  'DRIVERS_LICENSE',
  'PRC',
  'POSTAL',
  'VOTERS',
  'GSIS',
  'SSS',
  'UMID',
  'SENIOR',
  'OFW_ID',
  'SEAMANS_BOOK',
  'ALIEN_CERTIFICATE_REGISTRATION',
  'GOVERNMENT_OFFICE_GOCC_ID',
  'PWD_NCDA_ID',
  'IBP_ID',
  'SCHOOL_ID',
  'COMPANY_ID',
  'WORK_PERMIT',
  'VISA',
])

/** Step 3-style subset (create) — **Passport** first in LOV order per policy. */
export const HOME_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES = Object.freeze([
  'PASSPORT',
  'PHILID',
  'DRIVERS_LICENSE',
  'PRC',
  'UMID',
  'SSS',
  'GSIS',
  'POSTAL',
  'VOTERS',
  'SENIOR',
  'OFW_ID',
  'SEAMANS_BOOK',
  'COMPANY_ID',
])

/**
 * Max term and LTV hints per purpose (months). Vacant-lot caps apply when **`collateral_is_vacant_lot`**.
 * OFW caps follow Metro-style table (15y most cases; 10y vacant lot).
 */
export const HOME_LOAN_PURPOSE_DETAILS = Object.freeze({
  PURCHASE_HOUSE_AND_LOT: {
    label: 'Purchase of House and Lot',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
  },
  PURCHASE_TOWNHOUSE: {
    label: 'Purchase of Townhouse',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
  },
  PURCHASE_CONDOMINIUM: {
    label: 'Purchase of Condominium',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 70,
    max_ltv_secondary_percent: 75,
  },
  PURCHASE_VACANT_LOT: {
    label: 'Purchase of Vacant Lot',
    max_term_months_resident: 120,
    max_term_months_ofw: 120,
    max_ltv_percent: 60,
    max_ltv_secondary_percent: 75,
  },
  PURCHASE_LOT_AND_HOUSE_CONSTRUCTION: {
    label: 'Purchase of Lot and House Construction',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
  },
  HOUSE_CONSTRUCTION_OWNED_LOT: {
    label: 'House Construction on Owned Lot',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
  },
  REIMBURSEMENT: {
    label: 'Reimbursement',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
    vacant_lot_max_term_months_resident: 120,
    vacant_lot_max_term_months_ofw: 120,
  },
  RENOVATION_EXPANSION: {
    label: 'Renovation / Expansion',
    max_term_months_resident: 240,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
  },
  REFINANCING_LOAN_TAKEOUT: {
    label: 'Refinancing / Loan Take-out',
    max_term_months_resident: 180,
    max_term_months_ofw: 180,
    max_ltv_percent: 70,
    max_ltv_secondary_percent: 60,
    vacant_lot_max_term_months_resident: 120,
    vacant_lot_max_term_months_ofw: 120,
  },
  HOME_EQUITY_PERSONAL_CONSUMPTION: {
    label: 'Home Equity / Personal Consumption',
    max_term_months_resident: 60,
    max_term_months_ofw: 180,
    max_ltv_percent: 60,
    max_ltv_secondary_percent: 60,
    uses_home_equity_rate_tier: true,
    home_equity_improvement_max_term_months: 120,
  },
  PERSONAL_INVESTMENT_RESIDENTIAL_ASSET: {
    label: 'Personal Investment — Residential Asset Acquisition',
    max_term_months_resident: 300,
    max_term_months_ofw: 180,
    max_ltv_percent: 80,
    max_ltv_secondary_percent: 75,
    vacant_collateral_max_term_months_resident: 120,
    vacant_collateral_max_term_months_ofw: 120,
  },
})

export const HOME_LOAN_PURPOSES = Object.freeze(
  /** @type {readonly (keyof typeof HOME_LOAN_PURPOSE_DETAILS)[]} */ (
    Object.keys(HOME_LOAN_PURPOSE_DETAILS)
  ),
)

/** Fixed annual rates by repricing bucket (years 1–5). Home Equity tier adds +1% per year. */
export const HOME_LOAN_ANNUAL_RATES_BY_LOCK_IN_YEARS = Object.freeze([
  Object.freeze({
    lock_in_years: 1,
    annual_interest_percent: 6.25,
    home_equity_annual_percent: 7.25,
  }),
  Object.freeze({
    lock_in_years: 2,
    annual_interest_percent: 7.25,
    home_equity_annual_percent: 8.25,
  }),
  Object.freeze({
    lock_in_years: 3,
    annual_interest_percent: 7.75,
    home_equity_annual_percent: 8.75,
  }),
  Object.freeze({
    lock_in_years: 4,
    annual_interest_percent: 8.0,
    home_equity_annual_percent: 9.0,
  }),
  Object.freeze({
    lock_in_years: 5,
    annual_interest_percent: 8.25,
    home_equity_annual_percent: 9.25,
  }),
])

const _terms = []
for (let m = 12; m <= 300; m += 12) _terms.push(m)
export const HOME_LOAN_ALLOWED_TERM_MONTHS = Object.freeze(_terms)

function homeLoanPurposeLabel(value) {
  const d = HOME_LOAN_PURPOSE_DETAILS[/** @type {keyof typeof HOME_LOAN_PURPOSE_DETAILS} */ (value)]
  return d ? d.label : String(value).replace(/_/g, ' ')
}

function homeIdLabel(value) {
  /** @type {Readonly<Record<string, string>>} */
  const map = {
    PHILID: 'Philippine Identification (PhilID)',
    PASSPORT: 'Passport',
    DRIVERS_LICENSE: "Driver's License",
    PRC: 'Professional Regulation Commission ID',
    POSTAL: 'Postal Identity Card',
    VOTERS: "Voter's ID",
    GSIS: 'GSIS e-Card',
    SSS: 'SSS card / UMID-linked SSS',
    UMID: 'Unified Multi-Purpose ID',
    SENIOR: 'Senior Citizen Card',
    OFW_ID: 'Overseas Filipino Worker ID / e-card',
    SEAMANS_BOOK: "Seaman's Book",
    ALIEN_CERTIFICATE_REGISTRATION: 'ACR / ICR (foreign individuals)',
    GOVERNMENT_OFFICE_GOCC_ID: 'Government / GOCC ID (e.g. BSP, SEC, IC)',
    PWD_NCDA_ID: 'PWD ID (NCDA)',
    IBP_ID: 'Integrated Bar of the Philippines ID',
    SCHOOL_ID: 'Photo-bearing School ID (minor students)',
    COMPANY_ID: 'Company ID (signature-bearing, BSP/SEC/IC-regulated employer)',
    WORK_PERMIT: 'Work Permit',
    VISA: 'Visa',
  }
  return map[value] ?? String(value).replace(/_/g, ' ')
}

export const HOME_LOAN_PRODUCT = Object.freeze({
  product_code: 'HOME_LOAN',
  loan_type: 'home',
  name: 'Home Loan',
  bank_marketing_name: 'Metrobank Home Loan (Residential)',
  currency: 'PHP',
  principal_minor_unit_label: 'centavo (1 PHP = 100 centavos)',
  general_information:
    'Residential mortgage for purchase, construction, renovation, reimbursement, refinancing, and home equity (subject to collateral and purpose rules). Passport or PhilID preferred for ID; marriage contract if applicable.',
  eligibility: Object.freeze([
    'Minimum age 21 at application',
    'Minimum gross monthly family income of PHP 40,000 (mock: employment.gross_monthly_income_cents × 12 vs threshold)',
    'If employed: at least 2 years with current employer',
    'If self-employed / in business: profitable operations at least 3 years in current business (mock: years_in_current_business ≥ 3)',
    'Good credit history with no adverse findings (mock: additional_information.no_adverse_credit_history === true)',
    'Collateral must be residential (additional_information.collateral_property_type === RESIDENTIAL)',
  ]),
  loan_requirements: Object.freeze({
    basic_documents: Object.freeze([
      'Application form — fully filled-out and signed',
      'Valid ID — one (1) government-issued ID (Passport preferred)',
      'Marriage contract — if applicable',
    ]),
    id_types_acknowledged: Object.freeze([
      'Philippine Identification Card (PhilID)',
      'Passport (including foreign)',
      "Driver's License",
      'PRC ID',
      'Postal Identity Card',
      "Voter's ID",
      'GSIS e-Card',
      'SSS card or UMID',
      'Senior Citizen Card',
      'OFW ID / e-card',
      "Seaman's Book",
      'ACR / ICR (foreign individuals)',
      'Government / GOCC ID (BSP, SEC, Insurance Commission, etc.)',
      'PWD ID (NCDA)',
      'Integrated Bar of the Philippines ID',
      'Photo-bearing School ID (minor students, signed by principal)',
      'Company ID (signature-bearing, regulated employer)',
    ]),
    source_of_repayment: Object.freeze({
      employed_salaried: Object.freeze([
        'Certificate of Employment (COE) with compensation, position, tenure',
        'OR latest three (3) months payslips / payroll bank statements',
        'OR latest ITR or BIR 2316 (ITR may be required for total loans > PHP 3M)',
      ]),
      individual_in_business: Object.freeze([
        'Single prop: BIR 2303 + DTI / business permit',
        'Partnership: Articles of Partnership with partner names',
        'Corporation: SEC registration, AOI/By-laws, updated GIS',
        'Latest six (6) months bank statements',
        'If exposure > PHP 3M: latest ITR and 2 years audited financials',
      ]),
      ofw: Object.freeze([
        'Land-based: original COEC with salary, position, tenure, employer email',
        'Sea-based: latest POEA contract + certificate of sea service',
        'Six (6) months remittance proof OR three (3) months payslips / bank statements',
        'ITR only when total loans > PHP 3M',
      ]),
    }),
    collateral: Object.freeze([
      "Owner's duplicate TCT or CCT",
      'Tax declaration of land and/or improvement',
      'Construction: plans, bill of materials, specifications',
      'Developer tie-ups: CTS or reservation agreement',
    ]),
  }),
  credit_evaluation_note:
    'Applications subject to credit evaluation, appraisal, title investigation, and insurance quotations.',
  tenor_heading: 'Purpose, LTV, and maximum term',
  purpose_options: Object.freeze(
    HOME_LOAN_PURPOSES.map((value) =>
      Object.freeze({
        value,
        label: homeLoanPurposeLabel(value),
        ...HOME_LOAN_PURPOSE_DETAILS[value],
      }),
    ),
  ),
  fixed_interest_rates: HOME_LOAN_ANNUAL_RATES_BY_LOCK_IN_YEARS,
  fees_and_charges: Object.freeze({
    application_non_refundable: Object.freeze({
      appraisal_fee_cents: Object.freeze({
        metro_manila: phpToCentavos(4000),
        countryside: phpToCentavos(4500),
      }),
      title_investigation_per_title_cents: phpToCentavos(1000),
    }),
    after_approval: Object.freeze({
      handling_fee_cents: phpToCentavos(5000),
      notarial_per_document_cents: phpToCentavos(400),
      registration_fee_note: 'Quoted by Registry of Deeds',
      mri_note: 'Quoted by insurer (e.g. AXA)',
      property_insurance_note: 'Quoted by insurer (e.g. AXA)',
    }),
  }),
  allowed_term_months: HOME_LOAN_ALLOWED_TERM_MONTHS,
  min_principal_cents: phpToCentavos(500_000),
  max_principal_cents: phpToCentavos(50_000_000),
  /** Gross monthly **family** income floor — mock uses **employment.gross_monthly_income_cents**. */
  min_gross_monthly_family_income_cents: phpToCentavos(40_000),
  min_annual_income_cents: phpToCentavos(40_000) * 12,
  disbursement_rails: Object.freeze(['ACH', 'WIRE', 'INSTAPAY']),
  philippine_address_sample_rows: PH_ADDRESS_VALID_ROWS,
  step3_primary_id_document_types: Object.freeze(
    HOME_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES.map((value) =>
      Object.freeze({ value, label: homeIdLabel(value) }),
    ),
  ),
  primary_id_document_types: Object.freeze(
    HOME_LOAN_PRIMARY_ID_DOCUMENT_TYPES.map((value) =>
      Object.freeze({ value, label: homeIdLabel(value) }),
    ),
  ),
})

/**
 * @param {string} purposeCode
 * @param {boolean} isOfw
 * @param {boolean} collateralIsVacantLot
 * @param {{ home_equity_for_improvement?: boolean }} [extra]
 * @returns {number}
 */
export function homeLoanMaxTermMonthsAllowed(
  purposeCode,
  isOfw,
  collateralIsVacantLot,
  extra = {},
) {
  const d =
    HOME_LOAN_PURPOSE_DETAILS[/** @type {keyof typeof HOME_LOAN_PURPOSE_DETAILS} */ (purposeCode)]
  if (!d) return 0
  if (purposeCode === 'HOME_EQUITY_PERSONAL_CONSUMPTION') {
    const improvement = extra.home_equity_for_improvement === true
    const baseRes = improvement
      ? (d.home_equity_improvement_max_term_months ?? 120)
      : d.max_term_months_resident
    if (isOfw) {
      if (collateralIsVacantLot) return 120
      return d.max_term_months_ofw
    }
    if (collateralIsVacantLot) return 120
    return baseRes
  }
  const vacRes =
    'vacant_lot_max_term_months_resident' in d && collateralIsVacantLot
      ? d.vacant_lot_max_term_months_resident
      : null
  const vacOfw =
    'vacant_lot_max_term_months_ofw' in d && collateralIsVacantLot
      ? d.vacant_lot_max_term_months_ofw
      : null
  if (purposeCode === 'PERSONAL_INVESTMENT_RESIDENTIAL_ASSET' && collateralIsVacantLot) {
    return isOfw
      ? (d.vacant_collateral_max_term_months_ofw ?? 120)
      : (d.vacant_collateral_max_term_months_resident ?? 120)
  }
  if (isOfw) {
    if (vacOfw != null) return vacOfw
    return d.max_term_months_ofw
  }
  if (vacRes != null) return vacRes
  return d.max_term_months_resident
}

/**
 * @param {string} purposeCode
 * @returns {number} primary LTV cap percent (0–100)
 */
export function homeLoanMaxLtvPercent(purposeCode) {
  const d =
    HOME_LOAN_PURPOSE_DETAILS[/** @type {keyof typeof HOME_LOAN_PURPOSE_DETAILS} */ (purposeCode)]
  return d ? d.max_ltv_percent : 0
}

/**
 * Binding LTV for **principal_cents** vs **property_appraised_value_cents** (refinancing uses secondary cap).
 *
 * @param {string} [purposeCode]
 * @returns {number}
 */
export function homeLoanEffectiveLtvCapPercent(purposeCode) {
  if (purposeCode === 'REFINANCING_LOAN_TAKEOUT') {
    const d = HOME_LOAN_PURPOSE_DETAILS.REFINANCING_LOAN_TAKEOUT
    return d.max_ltv_secondary_percent ?? d.max_ltv_percent
  }
  return homeLoanMaxLtvPercent(purposeCode || '')
}
