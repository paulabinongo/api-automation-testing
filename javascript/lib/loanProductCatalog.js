/**
 * Loan product definitions for GET /v1/reference/loan-products and create-application validation.
 * Catalogue is **PHP-only**: **`principal_cents`** and **`employment.gross_monthly_income_cents`** are **PHP centavos** (1 PHP = 100 centavos).
 */

import {
  PERSONAL_LOAN_OCCUPATIONS,
  PERSONAL_LOAN_OCCUPATION_CODES,
} from './personalLoanOccupations.js'
import { PH_ADDRESS_VALID_ROWS, isValidPhAddressTriplet } from './philippineAddressReference.js'

/** @param {number} pesos Whole PHP */
function phpToCentavos(pesos) {
  return Math.round(pesos * 100)
}

/**
 * **`metrobank_client_type`** values accepted on **POST /loan-applications** for **PERSONAL_LOAN**.
 * **`EXISTING_CLIENT_CREDIT_CARD`** and **`NOT_METROBANK_CLIENT`** may **create** and **submit** without a deposit yet; **APPROVE** / **CONDITIONAL** remain **422** until **`metrobank_deposit_account_confirmed_at`** (or switching to **`EXISTING_CLIENT_DEPOSIT_ACCOUNT`**).
 */
export const PERSONAL_LOAN_METROBANK_CLIENT_TYPES = Object.freeze([
  'EXISTING_CLIENT_CREDIT_CARD',
  'EXISTING_CLIENT_DEPOSIT_ACCOUNT',
  'NOT_METROBANK_CLIENT',
])

/**
 * When **`metrobank_client_type`** is **`NOT_METROBANK_CLIENT`** or **`EXISTING_CLIENT_CREDIT_CARD`**, **`metrobank_deposit_repayment_plan`** is optional at intake; if present it must be one of these **string** values.
 * In **JSON** bodies the value must be quoted (e.g. **`"metrobank_deposit_repayment_plan": "WILL_OPEN_METROBANK_DEPOSIT"`**); bare **`WILL_OPEN_METROBANK_DEPOSIT`** without quotes is invalid JSON.
 */
export const METROBANK_DEPOSIT_REPAYMENT_PLAN = Object.freeze({
  WILL_OPEN_METROBANK_DEPOSIT: 'WILL_OPEN_METROBANK_DEPOSIT',
  DECLINES_METROBANK_DEPOSIT: 'DECLINES_METROBANK_DEPOSIT',
  WILL_USE_OTHER_BANK_DEPOSIT_ONLY: 'WILL_USE_OTHER_BANK_DEPOSIT_ONLY',
})

/** @param {unknown} body */
export function applicationRequiresMetrobankDepositAccountConfirmation(body) {
  const mt = String(body?.metrobank_client_type || '')
  return mt === 'NOT_METROBANK_CLIENT' || mt === 'EXISTING_CLIENT_CREDIT_CARD'
}

/** Display label for **primary_id_document_types** LOV (API **`value`** → UI **label**). */
export function primaryIdDocumentTypeLabel(value) {
  /** @type {Readonly<Record<string, string>>} */
  const map = Object.freeze({
    GSIS: 'GSIS',
    SSS: 'SSS',
    TIN: 'TIN',
    DRIVERS_LICENSE: "Driver's License",
    PASSPORT: 'Passport',
    UMID: 'UMID',
    PRC: 'PRC',
    COMPANY_ID: 'Company ID',
    EO226: 'EO 226',
    VISA: 'Visa',
    WORK_PERMIT: 'Work Permit',
    POSTAL: 'Postal',
    SENIOR: 'Senior',
    VOTERS: 'Voters',
    OTHERS: 'Others',
  })
  const v = String(value)
  return map[v] ?? v.replace(/_/g, ' ')
}

/**
 * Primary ID options — borrower declares one (Step 3); upload (**POST …/documents**) must match (or value after **PATCH**).
 * Aligned with common PH intake LOVs: GSIS, SSS, TIN, licenses, visas, etc.
 */
export const PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES = Object.freeze([
  'GSIS',
  'SSS',
  'TIN',
  'DRIVERS_LICENSE',
  'PASSPORT',
  'UMID',
  'PRC',
  'COMPANY_ID',
  'EO226',
  'VISA',
  'WORK_PERMIT',
  'POSTAL',
  'SENIOR',
  'VOTERS',
  'OTHERS',
])

/** Loan purpose LOV (Step 2 — **loan_purpose** on **POST /loan-applications**). */
export const PERSONAL_LOAN_PURPOSES = Object.freeze([
  'APPLIANCE_GADGETS',
  'BUSINESS',
  'CAR_REPAIR',
  'DEBT_CONSOLIDATION',
  'HOME_REPAIR',
  'MEDICAL_EMERGENCY',
  'PERSONAL_CONSUMPTION',
  'TRAVEL',
  'WEDDING',
])

/** Step 3 “Choose an ID” — **basic details** subset; **PATCH** may switch to any **primary_id_document_types** value before upload. */
export const PERSONAL_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES = Object.freeze([
  'GSIS',
  'SSS',
  'TIN',
  'DRIVERS_LICENSE',
  'PASSPORT',
  'UMID',
])

export const PERSONAL_LOAN_SOURCE_OF_FUNDS = Object.freeze([
  'EMPLOYED',
  'OTHERS',
  'RETIRED',
  'SELF_EMPLOYED',
  'UNEMPLOYED',
])

export const PERSONAL_LOAN_EMPLOYMENT_STATUSES = Object.freeze([
  'COTERMINOUS',
  'CONTRACTUAL',
  'PROBATIONARY',
  'PROJECT_BASED',
  'REGULAR',
  'ELECTED_OFFICIALS',
])

export const PERSONAL_LOAN_GENDERS = Object.freeze(['FEMALE', 'MALE', 'UNKNOWN'])

export const PERSONAL_LOAN_MARITAL_STATUSES = Object.freeze([
  'DIVORCED_OR_SEPARATED',
  'MARRIED',
  'SINGLE',
  'WIDOWED',
  'UNKNOWN',
])

export const PERSONAL_LOAN_EDUCATION_LEVELS = Object.freeze([
  'COLLEGE_GRADUATE',
  'GRADE_SCHOOL',
  'HIGH_SCHOOL',
  'LIMITED_NONE',
  'POSTGRADUATE',
  'TECHNICAL_VOCATIONAL',
])

/**
 * **Home / business landline** **area_code** LOV — **002** through **088** (3-digit) plus **0882** for product intake.
 * Use **GET /reference/loan-products** → **landline_area_code_options** in UIs.
 */
export const PERSONAL_LOAN_LANDLINE_AREA_CODES = Object.freeze([
  ...Array.from({ length: 87 }, (_, i) => String(i + 2).padStart(3, '0')),
  '0882',
])

/** @type {ReadonlySet<string>} */
const LANDLINE_AREA_CODE_SET = new Set(PERSONAL_LOAN_LANDLINE_AREA_CODES)

/** Optional **Present Home Address — Home Ownership** LOV (API **value**). */
export const PERSONAL_LOAN_HOME_OWNERSHIP = Object.freeze([
  'LIVING_WITH_PARENTS_RELATIVES',
  'MORTGAGE',
  'OTHER_COMPANY_PROVIDED',
  'OWNED',
  'RENTED',
])

function homeOwnershipDisplayLabel(value) {
  /** @type {Readonly<Record<string, string>>} */
  const map = Object.freeze({
    LIVING_WITH_PARENTS_RELATIVES: 'Living with Parents/Relatives',
    MORTGAGE: 'Mortgage',
    OTHER_COMPANY_PROVIDED: 'Other - Company Provided',
    OWNED: 'Owned',
    RENTED: 'Rented',
  })
  const v = String(value)
  return map[v] ?? v
}

function maritalStatusDisplayLabel(value) {
  /** @type {Readonly<Record<string, string>>} */
  const map = Object.freeze({
    DIVORCED_OR_SEPARATED: 'Divorced or Separated',
    MARRIED: 'Marriage',
    SINGLE: 'Single',
    WIDOWED: 'Widowed',
    UNKNOWN: 'Unknown',
  })
  const v = String(value)
  return map[v] ?? v
}

function educationLevelDisplayLabel(value) {
  /** @type {Readonly<Record<string, string>>} */
  const map = Object.freeze({
    COLLEGE_GRADUATE: 'College/Graduate',
    GRADE_SCHOOL: 'Grade School',
    HIGH_SCHOOL: 'High School',
    LIMITED_NONE: 'Limited/None',
    POSTGRADUATE: 'Postgraduate',
    TECHNICAL_VOCATIONAL: 'Technical/Vocational Schools',
  })
  const v = String(value)
  return map[v] ?? v
}

function loanPurposeLabel(value) {
  /** @type {Readonly<Record<string, string>>} */
  const map = Object.freeze({
    APPLIANCE_GADGETS: 'Appliance/Gadgets',
    BUSINESS: 'Business',
    CAR_REPAIR: 'Car Repair',
    DEBT_CONSOLIDATION: 'Debt Consolidation',
    HOME_REPAIR: 'Home Repair',
    MEDICAL_EMERGENCY: 'Medical Emergency',
    PERSONAL_CONSUMPTION: 'Personal Consumption',
    TRAVEL: 'Travel',
    WEDDING: 'Wedding',
  })
  const v = String(value)
  return map[v] ?? v
}

const personalTermOptions = Object.freeze([
  Object.freeze({
    term_months: 12,
    monthly_add_on_rate_percent: 1.75,
    annual_contractual_rate_percent: 36.742,
  }),
  Object.freeze({
    term_months: 18,
    monthly_add_on_rate_percent: 1.75,
    annual_contractual_rate_percent: 36.676,
  }),
  Object.freeze({
    term_months: 24,
    monthly_add_on_rate_percent: 1.5,
    annual_contractual_rate_percent: 31.459,
  }),
  Object.freeze({
    term_months: 36,
    monthly_add_on_rate_percent: 1.5,
    annual_contractual_rate_percent: 25.976,
  }),
])

/** Metrobank-style Personal Loan — sole product in this sandbox (PHP). */
export const PERSONAL_LOAN_PRODUCT = Object.freeze({
  product_code: 'PERSONAL_LOAN',
  loan_type: 'personal',
  name: 'Personal Loan',
  bank_marketing_name: 'Metrobank Personal Loan',
  currency: 'PHP',
  principal_minor_unit_label: 'centavo (1 PHP = 100 centavos)',
  general_information:
    'Metrobank Personal Loan can help you fund your large ticket transactions. You can use it for personal purchases, home repairs, weddings, tuition fees, debt consolidation, medical emergencies or any other unexpected expenses.',
  eligibility: Object.freeze([
    'Be a Filipino citizen',
    'Be at least 21 years old at the time of loan application and 65 years old upon loan maturity',
    'Have a gross annual income of at least PHP 250,000',
    'Have a Metrobank credit card or Metrobank deposit account (Step 1 prerequisite; mirrors “existing credit card” / servicing channel rules)',
    'If employed: be of regular status with current employer for at least 1 year',
    'If self-employed: be at least 2 years in the current business',
  ]),
  /** Wizard steps for **personal** origination UIs — document upload is after eligibility on Step 6 → Next. */
  intake_flow: Object.freeze({
    loan_type: 'personal',
    steps: Object.freeze([
      Object.freeze({
        step: 1,
        key: 'prerequisite',
        title: 'Pre-requisite',
        description:
          'Confirm you are an existing Metrobank client with a credit card or deposit account.',
      }),
      Object.freeze({
        step: 2,
        key: 'loan_details',
        title: 'Loan application details',
        description:
          '**Loan Amount** → **`principal_cents`** (PHP whole pesos only, **20,000–2,000,000**, required). **Loan Purpose** → **`loan_purpose`** (dropdown — Appliance/Gadgets … Wedding — **`loan_purposes`**). **Loan Term** → **`term_months`** (**12 / 18 / 24 / 36** months — **`term_options`**). **Computation** is read-only: monthly add-on rate, EIR, amortization, interest, fees (disbursement + DST), net proceeds — **`GET /v1/reference/loan-computation-preview`** or **`GET …/loan-applications/{id}/computation-preview`**.',
      }),
      Object.freeze({
        step: 3,
        key: 'basic_personal_details',
        title: 'Basic personal details',
        description:
          'Citizenship, date of birth, contact, consents, **primary government ID type** — **`borrower.primary_id_document_type`** must be one of **step3_primary_id_document_types[]** (six options). Step 7 upload uses the full **primary_id_document_types** LOV; after **PATCH**, upload must match the **current** declared ID.',
      }),
      Object.freeze({
        step: 4,
        key: 'basic_address_details',
        title: 'Present Home Address & other personal information',
        description:
          '**Present Home Address:** No./Blk./St. (**street_line**), optional Subdivision/Village (**subdivision_village**), Province (**province**), City/Town (**city_town**), Barangay (**barangay**), ZIP (**postal_code**), optional Home Ownership (**home_ownership**). Province/City/Barangay/ZIP must match a **dependent** row in **GET /reference/loan-products** → **philippine_address_sample_rows** (sandbox sample of PH LOVs). **Other information:** optional **home_phone** — **area_code** from **landline_area_code_options** (**002**–**088** and **0882**) + **8-digit** **subscriber_number**; **gender**, **marital_status**, **education**, **citizenship**, **place_of_birth** — labels on **gender_options**, **marital_status_options**, **education_options** match the product form. Mailing address if different from residential.',
      }),
      Object.freeze({
        step: 5,
        key: 'employment_details',
        title: 'Employment details',
        description:
          '**Source of funds** → **`employment.source_of_funds`**; **Employment status** → **`employment.employment_status`**; **Occupation** → **`occupations[]`**. **Employer** → **`employer_name`** when **EMPLOYED**; **`employer_address`** (No./Blk./St., optional **Subdivision/Building**, Province/City/Barangay/ZIP — **`philippine_address_sample_rows`**). **Industry**, **`business_email`**, tenure (**`years_working_total`**, **`years_with_current_employer`**), **`gross_monthly_income_cents`**. Optional **`business_mobile_phone`**, **`business_phone`** (same shape as **home_phone**: **landline_area_code_options** + **subscriber_number**). Self-employed: **`business_name`**, **`years_in_current_business`** (no **`employer_address`** required).',
      }),
      Object.freeze({
        step: 6,
        key: 'additional_information',
        title: 'Additional information',
        description:
          'Review entered values from loan through employment and addresses; edit or go back. **Next** runs eligibility against product criteria before document upload. **PEP screening** — **`additional_information.pep_close_family_or_public_position`** and **`pep_financial_transactions_on_behalf`** (both required booleans). If **either** is **true** (Yes), **production** banks normally trigger **enhanced due diligence**, Compliance queue, extra documentation, and escalated approvals (**this sandbox** still allows **Step 7** onward for testing). See **docs/DOCUMENTATION.md** (Step 6 — Additional information) for a typical real-world sequence.',
      }),
      Object.freeze({
        step: 7,
        key: 'document_requirements',
        title: 'Document requirements',
        description:
          'Upload required documents. ID-type picker lists **primary_id_document_types** (expanded vs Step 3). **POST …/documents** **primary_id_document_type** must exactly match **borrower.primary_id_document_type** (including after **PATCH**) or **422**. If **metrobank_client_type** is **NOT_METROBANK_CLIENT** or **EXISTING_CLIENT_CREDIT_CARD** with **WILL_OPEN_METROBANK_DEPOSIT**: **POST …/metrobank-deposit-account/confirm** after documents (through **IN_UNDERWRITING**) records account-opening for **ADA** (required before **underwriting** **APPROVE** / **CONDITIONAL**). **If Step 6 PEP is Yes** on either question: **POST …/compliance/pep-clearance** after documents and **before** **submit**. **PATCH** to **additional_information** clears prior **pep** / **Metrobank confirm** timestamps — repeat gates as needed.',
      }),
    ]),
  }),
  metrobank_client_prerequisite: Object.freeze({
    question: 'How will loan repayments be made?',
    explanation:
      'Personal Loan collections use **automatic debit (ADA)** against a **Metrobank deposit account** only. A Metrobank **credit card alone** is **not** sufficient for **approval** — the borrower must **confirm** a Metrobank deposit account (or already have one) before **underwriting** can **APPROVE**. You may still **create** and **submit** while arranging the account. Existing **credit card clients** usually have a simple branch process (**one valid ID** + initial deposit; amounts depend on the account type). Full **reference**: **docs/DOCUMENTATION.md** §5.2 — *Opening a Metrobank deposit account*. Declining a Metrobank deposit or other-bank-only ADA cannot be **approved** in this sandbox.',
    choices: Object.freeze([
      Object.freeze({
        value: 'EXISTING_CLIENT_DEPOSIT_ACCOUNT',
        label: 'Yes — I already have a Metrobank deposit account (for ADA / repayments)',
      }),
      Object.freeze({
        value: 'EXISTING_CLIENT_CREDIT_CARD',
        label:
          'Metrobank credit card holder — I will open/use a Metrobank deposit account for ADA repayments (confirm before approval)',
      }),
      Object.freeze({
        value: 'NOT_METROBANK_CLIENT',
        label:
          'Not yet a Metrobank client — I will open a Metrobank deposit account for repayments (confirm before approval)',
      }),
    ]),
  }),
  credit_evaluation_note:
    'Applications of eligible applicants shall be subject to credit evaluation.',
  tenor_heading: 'Tenor or Loan Terms',
  term_options: personalTermOptions,
  fees_and_charges: Object.freeze({
    disbursement_fee_php: 1500,
    documentary_stamp_tax: Object.freeze({
      description: '0.75% of the loan amount (for loans above Php 250,000)',
      rate_percent: 0.75,
      threshold_principal_php: 250_000,
    }),
    late_payment_fee_php_per_incidence: 850,
    pre_termination_fee: Object.freeze({
      description: '5% of Outstanding Balance or Php 550, whichever is higher',
      percent_of_outstanding_balance: 5,
      minimum_php: 550,
    }),
    disclaimer:
      'Fees and charges are subject to change without prior notice. You can use Metrobank’s Personal Loan Calculator to compute for the monthly amortization based on your preferred loan amount and loan tenor.',
  }),
  allowed_term_months: Object.freeze([12, 18, 24, 36]),
  min_principal_cents: phpToCentavos(20_000),
  max_principal_cents: phpToCentavos(2_000_000),
  min_annual_income_cents: phpToCentavos(250_000),
  disbursement_rails: Object.freeze(['ACH', 'WIRE']),
  loan_purposes: Object.freeze(
    PERSONAL_LOAN_PURPOSES.map((value) => Object.freeze({ value, label: loanPurposeLabel(value) })),
  ),
  step3_primary_id_document_types: Object.freeze(
    PERSONAL_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES.map((value) =>
      Object.freeze({
        value,
        label: primaryIdDocumentTypeLabel(value),
      }),
    ),
  ),
  source_of_funds_options: Object.freeze(
    PERSONAL_LOAN_SOURCE_OF_FUNDS.map((value) =>
      Object.freeze({
        value,
        label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }),
    ),
  ),
  employment_status_options: Object.freeze(
    PERSONAL_LOAN_EMPLOYMENT_STATUSES.map((value) =>
      Object.freeze({
        value,
        label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }),
    ),
  ),
  gender_options: Object.freeze([
    Object.freeze({ value: 'FEMALE', label: 'Female' }),
    Object.freeze({ value: 'MALE', label: 'Male' }),
    Object.freeze({ value: 'UNKNOWN', label: 'Unknown' }),
  ]),
  marital_status_options: Object.freeze(
    PERSONAL_LOAN_MARITAL_STATUSES.map((value) =>
      Object.freeze({
        value,
        label: maritalStatusDisplayLabel(value),
      }),
    ),
  ),
  education_options: Object.freeze(
    PERSONAL_LOAN_EDUCATION_LEVELS.map((value) =>
      Object.freeze({
        value,
        label: educationLevelDisplayLabel(value),
      }),
    ),
  ),
  /** Sample PH Province / City/Town / Barangay / ZIP rows — validate **residential_address** triplets in the mock. */
  philippine_address_sample_rows: PH_ADDRESS_VALID_ROWS,
  /** **area_code** choices for **home_phone** / **business_phone** (**002**–**088** and **0882**). */
  landline_area_code_options: Object.freeze(
    PERSONAL_LOAN_LANDLINE_AREA_CODES.map((value) => Object.freeze({ value, label: value })),
  ),
  home_ownership_options: Object.freeze(
    PERSONAL_LOAN_HOME_OWNERSHIP.map((value) =>
      Object.freeze({
        value,
        label: homeOwnershipDisplayLabel(value),
      }),
    ),
  ),
  occupations: PERSONAL_LOAN_OCCUPATIONS,
  /**
   * Full ID LOV for **Step 7** upload and for **PATCH** (borrower may switch ID type before documents).
   * **Step 3 create** accepts **step3_primary_id_document_types** only.
   */
  primary_id_document_types: Object.freeze(
    PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES.map((value) =>
      Object.freeze({
        value,
        label: primaryIdDocumentTypeLabel(value),
      }),
    ),
  ),
})

/** @type {Readonly<Record<string, typeof PERSONAL_LOAN_PRODUCT>>} */
export const LOAN_PRODUCTS_BY_CODE = Object.freeze({
  [PERSONAL_LOAN_PRODUCT.product_code]: PERSONAL_LOAN_PRODUCT,
})

/** Sorted **term_months** values for the catalogue (PHP Personal Loan). */
export const ALL_CATALOG_TERM_MONTHS = PERSONAL_LOAN_PRODUCT.allowed_term_months

/**
 * @returns {{ products: object[], note: string }}
 */
export function buildLoanProductReferencePayload() {
  return {
    products: [{ ...PERSONAL_LOAN_PRODUCT }],
    note: '**All amounts** in **PHP centavos** on **principal_cents** and **employment.gross_monthly_income_cents** (×12 vs **min_annual_income_cents** on the product). Principal: **PHP 20,000**–**2,000,000** (whole pesos only). **loan_purpose**, **term_months** (**12|18|24|36**), **additional_information** (PEP — **Yes** triggers **POST …/compliance/pep-clearance** after **documents**, before **submit**; same as **openapi.json** / **Swagger**), **borrower** (Present Home Address + **philippine_address_sample_rows**, optional **home_phone** / **landline_area_code_options**, names, consents, Step 3 ID subset on create), **employment** (**employer_address** when **EMPLOYED**; optional **business_mobile_phone**, **business_phone**). Step 7 **POST …/documents** must match declared ID. **GET /v1/reference/loan-computation-preview** (add-on, EIR, amortization, fees, net proceeds). Full path list: **Swagger** `/docs` or repo **openapi.json**.',
  }
}

const NAME_PART_RE = /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]+( [A-Za-z\u00C0-\u024F\u1E00-\u1EFF]+)*$/

function isValidNamePart(s, maxLen = 30) {
  const t = String(s || '').trim()
  if (t.length < 1 || t.length > maxLen) return false
  return NAME_PART_RE.test(t)
}

/** Optional middle name: omit, whitespace-only, or 1–30 chars, letters/spaces only, no lead/trail space. */
function validateOptionalMiddleName(b, errs) {
  const m = b.middle_name
  if (m == null) return
  const raw = String(m)
  if (raw.trim() === '') return
  if (raw !== raw.trim()) {
    errs.push(
      'borrower.middle_name must not have leading or trailing spaces (optional field; 1–30 letters/spaces only when provided)',
    )
    return
  }
  if (raw.length < 1 || raw.length > 30 || !NAME_PART_RE.test(raw)) {
    errs.push(
      'borrower.middle_name is optional; when provided it must be 1–30 characters, letters and spaces only (no digits or special characters), with single spaces between words',
    )
  }
}

function isLegacyResidentialAddress(ra) {
  const sl = ra.street_line
  return (
    (sl == null || String(sl).trim() === '') && ra.line1 != null && String(ra.line1).trim() !== ''
  )
}

function validateStreetLineNoBlkSt(raw, errs, fieldPath) {
  if (raw !== raw.trim()) {
    errs.push(`${fieldPath} (No./Blk./St.) must not have leading or trailing spaces`)
    return false
  }
  if (raw.length < 1 || raw.length > 30 || !NAME_PART_RE.test(raw)) {
    errs.push(
      `${fieldPath} must be 1–30 characters, letters and spaces only (no digits or special characters), single spaces between words`,
    )
    return false
  }
  return true
}

function validateOptionalSubdivisionVillage(ra, errs) {
  const m = ra.subdivision_village
  if (m == null) return
  const raw = String(m)
  if (raw.trim() === '') return
  if (raw !== raw.trim()) {
    errs.push(
      'borrower.residential_address.subdivision_village must not have leading or trailing spaces when provided',
    )
    return
  }
  if (raw.length > 30 || !NAME_PART_RE.test(raw)) {
    errs.push(
      'borrower.residential_address.subdivision_village: optional; when provided, max 30 characters, letters and spaces only (no digits or special characters)',
    )
  }
}

function validateResidentialAddress(ra, errs) {
  if (!ra || typeof ra !== 'object') {
    errs.push('borrower.residential_address required')
    return
  }
  if (isLegacyResidentialAddress(ra)) {
    if (!String(ra.line1 || '').trim()) {
      errs.push('borrower.residential_address.line1 required (legacy shape)')
    }
    if (!String(ra.city || '').trim())
      errs.push('borrower.residential_address.city required (legacy shape)')
    if (!String(ra.province_region || '').trim()) {
      errs.push('borrower.residential_address.province_region required (legacy shape)')
    }
    if (ra.postal_code == null || String(ra.postal_code).trim() === '') {
      errs.push('borrower.residential_address.postal_code required (legacy shape)')
    }
    return
  }

  const st = ra.street_line
  if (st == null || String(st).trim() === '') {
    errs.push(
      'borrower.residential_address.street_line required (No./Blk./St.) — or use legacy fields line1, city, province_region, postal_code',
    )
    return
  }
  validateStreetLineNoBlkSt(String(st), errs, 'borrower.residential_address.street_line')

  validateOptionalSubdivisionVillage(ra, errs)

  const prov = ra.province != null ? String(ra.province).trim() : ''
  const city = ra.city_town != null ? String(ra.city_town).trim() : ''
  const brgy = ra.barangay != null ? String(ra.barangay).trim() : ''
  const zip = ra.postal_code != null ? String(ra.postal_code).trim() : ''

  if (!prov) errs.push('borrower.residential_address.province required (Province)')
  if (!city) errs.push('borrower.residential_address.city_town required (City/Town)')
  if (!brgy) errs.push('borrower.residential_address.barangay required (Barangay)')
  if (!zip) {
    errs.push('borrower.residential_address.postal_code required (ZIP Code)')
  } else if (!/^\d{4}$/.test(zip)) {
    errs.push(
      'borrower.residential_address.postal_code must be a 4-digit ZIP (integer string, e.g. "1200")',
    )
  }

  if (prov && city && brgy && zip && /^\d{4}$/.test(zip)) {
    if (!isValidPhAddressTriplet(prov, city, brgy, zip)) {
      errs.push(
        'borrower.residential_address: Province, City/Town, Barangay, and ZIP must match one combined row in GET /reference/loan-products → philippine_address_sample_rows',
      )
    }
  }

  const ho = ra.home_ownership
  if (ho != null && String(ho).trim() !== '') {
    const h = String(ho)
    if (!PERSONAL_LOAN_HOME_OWNERSHIP.includes(h)) {
      errs.push(
        'borrower.residential_address.home_ownership must be one of: ' +
          PERSONAL_LOAN_HOME_OWNERSHIP.join(', '),
      )
    }
  }
}

/**
 * Optional landline: **area_code** (see **GET /reference/loan-products** → **landline_area_code_options**: **002–088** or **0882**) + **subscriber_number** (8 digits).
 * @param {unknown} hp
 * @param {string[]} errs
 * @param {string} path e.g. **borrower.home_phone**
 */
function validateOptionalLandlinePhone(hp, errs, path) {
  if (!hp || typeof hp !== 'object') return
  const ac = hp.area_code
  const sub = hp.subscriber_number
  const empty = (v) => v == null || String(v).trim() === ''
  if (empty(ac) && empty(sub)) return
  if (empty(ac) || empty(sub)) {
    errs.push(`${path}: when provided, area_code and subscriber_number are both required`)
    return
  }
  const acs = String(ac).trim()
  if (!LANDLINE_AREA_CODE_SET.has(acs)) {
    errs.push(
      `${path}.area_code must be one of GET /v1/reference/loan-products → landline_area_code_options (002–088 or 0882)`,
    )
    return
  }
  const subs = String(sub).trim()
  if (!/^\d{8}$/.test(subs)) {
    errs.push(`${path}.subscriber_number must be exactly 8 digits`)
  }
}

function validateOptionalHomePhone(b, errs) {
  validateOptionalLandlinePhone(b.home_phone, errs, 'borrower.home_phone')
}

function validateOptionalSubdivisionBuilding(addr, errs) {
  const m = addr.subdivision_building
  if (m == null) return
  const raw = String(m)
  if (raw.trim() === '') return
  if (raw !== raw.trim()) {
    errs.push(
      'employment.employer_address.subdivision_building must not have leading or trailing spaces when provided',
    )
    return
  }
  if (raw.length > 30 || !NAME_PART_RE.test(raw)) {
    errs.push(
      'employment.employer_address.subdivision_building: optional; when provided, max 30 characters, letters and spaces only (no digits or special characters)',
    )
  }
}

/** Required when **employment.status** is **EMPLOYED** — same PH row rules as **`residential_address`** (no **home_ownership**). */
function validateEmployerAddress(addr, errs) {
  if (!addr || typeof addr !== 'object') {
    errs.push('employment.employer_address required when employment.status is EMPLOYED')
    return
  }

  const st = addr.street_line
  if (st == null || String(st).trim() === '') {
    errs.push('employment.employer_address.street_line required (No./Blk./St.)')
    return
  }
  validateStreetLineNoBlkSt(String(st), errs, 'employment.employer_address.street_line')

  validateOptionalSubdivisionBuilding(addr, errs)

  const prov = addr.province != null ? String(addr.province).trim() : ''
  const city = addr.city_town != null ? String(addr.city_town).trim() : ''
  const brgy = addr.barangay != null ? String(addr.barangay).trim() : ''
  const zip = addr.postal_code != null ? String(addr.postal_code).trim() : ''

  if (!prov) errs.push('employment.employer_address.province required (Province)')
  if (!city) errs.push('employment.employer_address.city_town required (City/Town)')
  if (!brgy) errs.push('employment.employer_address.barangay required (Barangay)')
  if (!zip) {
    errs.push('employment.employer_address.postal_code required (ZIP Code)')
  } else if (!/^\d{4}$/.test(zip)) {
    errs.push(
      'employment.employer_address.postal_code must be a 4-digit ZIP (integer string, e.g. "1200")',
    )
  }

  if (prov && city && brgy && zip && /^\d{4}$/.test(zip)) {
    if (!isValidPhAddressTriplet(prov, city, brgy, zip)) {
      errs.push(
        'employment.employer_address: Province, City/Town, Barangay, and ZIP must match one combined row in GET /reference/loan-products → philippine_address_sample_rows',
      )
    }
  }
}

function validateOptionalBusinessMobile(emp, errs) {
  const raw = emp.business_mobile_phone
  if (raw == null || String(raw).trim() === '') return
  if (!normalizePhilippineMobileDigits(raw)) {
    errs.push(
      'employment.business_mobile_phone must be Philippine mobile (+639XXXXXXXXX, 09XXXXXXXXX, or 9XXXXXXXXX — national digit 9)',
    )
  }
}

function validatePlaceOfBirthStrict(b, errs) {
  const p = b.place_of_birth
  if (p == null || String(p).trim() === '') {
    errs.push('borrower.place_of_birth required (Place of Birth)')
    return
  }
  const raw = String(p)
  if (raw !== raw.trim()) {
    errs.push('borrower.place_of_birth must not have leading or trailing spaces')
    return
  }
  if (raw.length < 3 || raw.length > 30 || !NAME_PART_RE.test(raw)) {
    errs.push(
      'borrower.place_of_birth must be 3–30 characters, letters and spaces only (no digits or special characters)',
    )
  }
}

function isValidEmailLoose(s) {
  const t = String(s || '').trim()
  if (t.length < 3 || t.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** @param {unknown} s @returns {string | null} national form **9XXXXXXXXX** (10 digits) */
export function normalizePhilippineMobileDigits(s) {
  const raw = String(s || '').replace(/\s/g, '')
  let m = /^\+63(9\d{9})$/.exec(raw)
  if (m) return m[1]
  m = /^63(9\d{9})$/.exec(raw)
  if (m) return m[1]
  m = /^09(\d{9})$/.exec(raw)
  if (m) return '9' + m[1]
  m = /^(9\d{9})$/.exec(raw)
  if (m) return m[1]
  return null
}

function isDobStrictlyBeforeToday(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return false
  const [y, mo, d] = String(ymd).split('-').map(Number)
  const birth = new Date(y, mo - 1, d)
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return birth < today
}

/**
 * Step 3–5 field shapes for **PERSONAL_LOAN** (before eligibility).
 * @param {unknown} body
 * @param {{ primaryIdPolicy?: 'step3_only' | 'full' }} [options] — **PATCH** / merged drafts use **full** so borrowers may declare IDs outside the Step 3 subset before document upload.
 * @returns {string[]}
 */
export function validatePersonalLoanIntakeShape(body, options = {}) {
  const primaryIdPolicy = options.primaryIdPolicy === 'full' ? 'full' : 'step3_only'
  const errs = []
  if (!body || typeof body !== 'object') return errs
  const b = body.borrower
  if (!b || typeof b !== 'object') return errs

  const lp = body.loan_purpose
  if (lp == null || String(lp).trim() === '') errs.push('loan_purpose required')
  else if (!PERSONAL_LOAN_PURPOSES.includes(String(lp))) {
    errs.push('loan_purpose must be one of: ' + PERSONAL_LOAN_PURPOSES.join(', '))
  }

  const ai = body.additional_information
  if (!ai || typeof ai !== 'object') {
    errs.push('additional_information required (PEP screening — both boolean fields)')
  } else {
    if (typeof ai.pep_close_family_or_public_position !== 'boolean') {
      errs.push('additional_information.pep_close_family_or_public_position must be true or false')
    }
    if (typeof ai.pep_financial_transactions_on_behalf !== 'boolean') {
      errs.push('additional_information.pep_financial_transactions_on_behalf must be true or false')
    }

    const mt = String(body.metrobank_client_type || '')
    const needsDepositRepaymentPlan =
      mt === 'NOT_METROBANK_CLIENT' || mt === 'EXISTING_CLIENT_CREDIT_CARD'
    if (needsDepositRepaymentPlan) {
      const plan = ai.metrobank_deposit_repayment_plan
      const P = METROBANK_DEPOSIT_REPAYMENT_PLAN
      const validPlans = [
        P.WILL_OPEN_METROBANK_DEPOSIT,
        P.DECLINES_METROBANK_DEPOSIT,
        P.WILL_USE_OTHER_BANK_DEPOSIT_ONLY,
      ]
      if (plan != null && plan !== '' && !validPlans.includes(plan)) {
        errs.push(
          'additional_information.metrobank_deposit_repayment_plan must be one of: ' +
            validPlans.join(', ') +
            ' when provided (optional for NOT_METROBANK_CLIENT or EXISTING_CLIENT_CREDIT_CARD)',
        )
      }
    }
  }

  const fn = b.first_name
  const ln = b.last_name
  const hasParts = fn != null && String(fn).trim() !== '' && ln != null && String(ln).trim() !== ''
  if (hasParts) {
    if (!isValidNamePart(fn)) {
      errs.push(
        'borrower.first_name must be 1–30 letters/spaces only, trimmed, no leading/trailing spaces',
      )
    }
    if (!isValidNamePart(ln)) {
      errs.push(
        'borrower.last_name must be 1–30 letters/spaces only, trimmed, no leading/trailing spaces',
      )
    }
  } else {
    if (!b.full_name || !String(b.full_name).trim()) {
      errs.push(
        'borrower.first_name and borrower.last_name required (or legacy borrower.full_name)',
      )
    } else {
      const full = String(b.full_name).trim()
      if (full.length < 1 || full.length > 100 || !NAME_PART_RE.test(full)) {
        errs.push('borrower.full_name must be letters/spaces only, 1–100 characters, trimmed')
      }
    }
  }

  validateOptionalMiddleName(b, errs)

  if (!isValidEmailLoose(b.email)) errs.push('borrower.email must be a valid email address')

  if (!normalizePhilippineMobileDigits(b.mobile_phone)) {
    errs.push(
      'borrower.mobile_phone required — Philippine mobile: +639XXXXXXXXX, 09XXXXXXXXX, or 9XXXXXXXXX (first national digit 9)',
    )
  }

  if (!b.date_of_birth || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date_of_birth))) {
    errs.push('borrower.date_of_birth required (YYYY-MM-DD)')
  } else if (!isDobStrictlyBeforeToday(b.date_of_birth)) {
    errs.push('borrower.date_of_birth must be strictly before today (past date of birth)')
  }

  if (!b.citizenship) errs.push('borrower.citizenship required')
  else if (String(b.citizenship) !== 'FILIPINO') {
    errs.push('borrower.citizenship must be FILIPINO for this product')
  }

  const pid = b.primary_id_document_type
  const allowedPid =
    primaryIdPolicy === 'full'
      ? PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES
      : PERSONAL_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES
  if (pid == null || String(pid).trim() === '') {
    errs.push(
      'borrower.primary_id_document_type required — create: GET /v1/reference/loan-products → step3_primary_id_document_types; PATCH may use full primary_id_document_types',
    )
  } else if (!allowedPid.includes(String(pid))) {
    errs.push(
      'borrower.primary_id_document_type must be one of: ' +
        allowedPid.join(', ') +
        (primaryIdPolicy === 'step3_only'
          ? ' (Step 3 subset on create — use PATCH then upload for other ID types)'
          : ''),
    )
  }

  const idNum = b.primary_id_document_number
  if (idNum == null || !/^\d{11}$/.test(String(idNum).trim())) {
    errs.push('borrower.primary_id_document_number must be exactly 11 digits')
  }
  const c = b.consents
  if (!c || typeof c !== 'object') errs.push('borrower.consents required')
  else {
    if (c.terms_of_use_accepted !== true) {
      errs.push('borrower.consents.terms_of_use_accepted must be true')
    }
    if (c.terms_and_conditions_accepted !== true) {
      errs.push('borrower.consents.terms_and_conditions_accepted must be true')
    }
    if (c.data_privacy_policy_accepted !== true) {
      errs.push('borrower.consents.data_privacy_policy_accepted must be true')
    }
  }

  if (!PERSONAL_LOAN_GENDERS.includes(/** @type {any} */ (b.gender))) {
    errs.push('borrower.gender required — FEMALE | MALE | UNKNOWN')
  }
  if (!PERSONAL_LOAN_MARITAL_STATUSES.includes(/** @type {any} */ (b.marital_status))) {
    errs.push(
      'borrower.marital_status required — see GET /v1/reference/loan-products → marital_status_options',
    )
  }
  if (!PERSONAL_LOAN_EDUCATION_LEVELS.includes(/** @type {any} */ (b.education))) {
    errs.push(
      'borrower.education required — see GET /v1/reference/loan-products → education_options (dropdown + search in production)',
    )
  }
  validatePlaceOfBirthStrict(b, errs)

  validateResidentialAddress(b.residential_address, errs)
  validateOptionalHomePhone(b, errs)

  if (typeof b.mailing_same_as_residential !== 'boolean') {
    errs.push('borrower.mailing_same_as_residential must be true or false')
  } else if (!b.mailing_same_as_residential) {
    const ma = b.mailing_address
    if (!ma || typeof ma !== 'object')
      errs.push('borrower.mailing_address required when mailing_same_as_residential is false')
    else {
      if (!String(ma.line1 || '').trim()) errs.push('borrower.mailing_address.line1 required')
      if (!String(ma.city || '').trim()) errs.push('borrower.mailing_address.city required')
      if (!String(ma.province_region || '').trim()) {
        errs.push('borrower.mailing_address.province_region required')
      }
      if (ma.postal_code == null || String(ma.postal_code).trim() === '') {
        errs.push('borrower.mailing_address.postal_code required')
      }
    }
  }

  const emp = body.employment
  if (!emp || typeof emp !== 'object') errs.push('employment required')
  else {
    if (
      !emp.source_of_funds ||
      !PERSONAL_LOAN_SOURCE_OF_FUNDS.includes(String(emp.source_of_funds))
    ) {
      errs.push('employment.source_of_funds required — ' + PERSONAL_LOAN_SOURCE_OF_FUNDS.join(', '))
    }
    if (
      !emp.employment_status ||
      !PERSONAL_LOAN_EMPLOYMENT_STATUSES.includes(String(emp.employment_status))
    ) {
      errs.push(
        'employment.employment_status required — ' + PERSONAL_LOAN_EMPLOYMENT_STATUSES.join(', '),
      )
    }
    if (emp.occupation == null || !PERSONAL_LOAN_OCCUPATION_CODES.has(String(emp.occupation))) {
      errs.push(
        'employment.occupation must be one of occupations[].value on GET /v1/reference/loan-products',
      )
    }
    const industry = String(emp.industry || '').trim()
    if (industry.length < 2 || industry.length > 80) {
      errs.push('employment.industry required (2–80 characters)')
    }
    if (!isValidEmailLoose(emp.business_email)) {
      errs.push('employment.business_email must be a valid email (e.g. name@company.com)')
    }
    if (typeof emp.years_working_total !== 'number' || emp.years_working_total < 0) {
      errs.push('employment.years_working_total must be a number >= 0')
    }
    if (
      typeof emp.gross_monthly_income_cents !== 'number' ||
      !Number.isFinite(emp.gross_monthly_income_cents) ||
      emp.gross_monthly_income_cents < 0
    ) {
      errs.push('employment.gross_monthly_income_cents must be a number >= 0 (PHP centavos)')
    } else if (
      PERSONAL_LOAN_PRODUCT.min_annual_income_cents != null &&
      emp.gross_monthly_income_cents * 12 < PERSONAL_LOAN_PRODUCT.min_annual_income_cents
    ) {
      errs.push(
        'employment.gross_monthly_income_cents × 12 must be at least the product minimum annual income (PHP 250,000/year — see GET /v1/reference/loan-products → min_annual_income_cents)',
      )
    }

    if (emp.status !== 'EMPLOYED' && emp.status !== 'SELF_EMPLOYED') {
      errs.push('employment.status must be EMPLOYED or SELF_EMPLOYED')
    } else if (emp.source_of_funds === 'EMPLOYED' && emp.status !== 'EMPLOYED') {
      errs.push('employment.status must be EMPLOYED when employment.source_of_funds is EMPLOYED')
    } else if (emp.source_of_funds === 'SELF_EMPLOYED' && emp.status !== 'SELF_EMPLOYED') {
      errs.push(
        'employment.status must be SELF_EMPLOYED when employment.source_of_funds is SELF_EMPLOYED',
      )
    } else if (emp.status === 'EMPLOYED') {
      if (!String(emp.employer_name || '').trim()) {
        errs.push('employment.employer_name required when status is EMPLOYED')
      }
      if (typeof emp.years_with_current_employer !== 'number') {
        errs.push('employment.years_with_current_employer must be a number')
      }
      if (typeof emp.is_regular_employment !== 'boolean') {
        errs.push('employment.is_regular_employment must be true or false')
      }
      validateEmployerAddress(emp.employer_address, errs)
    } else {
      if (!String(emp.business_name || '').trim()) {
        errs.push('employment.business_name required when status is SELF_EMPLOYED')
      }
      if (typeof emp.years_in_current_business !== 'number') {
        errs.push('employment.years_in_current_business must be a number')
      }
    }

    if (
      typeof emp.years_with_current_employer === 'number' &&
      typeof emp.years_working_total === 'number' &&
      emp.years_with_current_employer > emp.years_working_total
    ) {
      errs.push('employment.years_with_current_employer must be <= employment.years_working_total')
    }

    validateOptionalBusinessMobile(emp, errs)
    validateOptionalLandlinePhone(emp.business_phone, errs, 'employment.business_phone')
  }

  return errs
}

/**
 * @param {string[]} errs
 * @param {readonly number[]} allowed
 */
function pushTermError(errs, allowed) {
  errs.push(
    'term_months must be one of approved terms for this product (months): ' + allowed.join(', '),
  )
}

/**
 * @param {unknown} body application body
 * @param {{ personalLoanPrimaryIdPolicy?: 'step3_only' | 'full' }} [options] — use **full** when validating a **PATCH** merge so **borrower.primary_id_document_type** may be outside the Step 3 subset.
 * @returns {string[]}
 */
export function validateApplicationAgainstCatalog(body, options = {}) {
  const errs = []
  if (!body || typeof body !== 'object') return ['Invalid body']
  const code = body.product_code
  if (code == null || code === '') {
    errs.push('product_code required')
    return errs
  }
  const product = LOAN_PRODUCTS_BY_CODE[String(code)]
  if (!product) {
    errs.push('Unknown product_code — use GET /v1/reference/loan-products')
    return errs
  }
  if (typeof body.principal_cents !== 'number' || body.principal_cents <= 0) {
    errs.push('principal_cents must be > 0')
  } else {
    if (body.principal_cents < product.min_principal_cents) {
      errs.push(
        `principal_cents below minimum for ${product.product_code} (${product.currency} minor units): ${product.min_principal_cents}`,
      )
    }
    if (body.principal_cents > product.max_principal_cents) {
      errs.push(
        `principal_cents above maximum for ${product.product_code} (${product.currency} minor units): ${product.max_principal_cents}`,
      )
    }
  }
  if (
    product.product_code === 'PERSONAL_LOAN' &&
    typeof body.principal_cents === 'number' &&
    body.principal_cents > 0
  ) {
    if (!Number.isInteger(body.principal_cents) || body.principal_cents % 100 !== 0) {
      errs.push(
        'principal_cents must be a whole PHP amount (integer multiple of 100 centavos — no fractional pesos)',
      )
    }
  }
  const term = Number(body.term_months)
  if (typeof body.term_months !== 'number' || !product.allowed_term_months.includes(term)) {
    pushTermError(errs, product.allowed_term_months)
  }
  const b = body.borrower
  if (!b || typeof b !== 'object') errs.push('borrower required')
  else {
    const hasStructuredName =
      b.first_name && String(b.first_name).trim() && b.last_name && String(b.last_name).trim()
    const hasLegacyFull = b.full_name && String(b.full_name).trim()
    if (!hasStructuredName && !hasLegacyFull) {
      errs.push(
        'borrower.first_name and borrower.last_name required (or legacy borrower.full_name)',
      )
    }
    if (!b.email) errs.push('borrower.email required')
  }
  const idPol = options.personalLoanPrimaryIdPolicy === 'full' ? 'full' : 'step3_only'
  if (product.product_code === 'PERSONAL_LOAN') {
    errs.push(...validatePersonalLoanIntakeShape(body, { primaryIdPolicy: idPol }))
    const mt = body.metrobank_client_type
    if (mt == null || mt === '') {
      errs.push(
        'metrobank_client_type required — EXISTING_CLIENT_DEPOSIT_ACCOUNT, EXISTING_CLIENT_CREDIT_CARD, or NOT_METROBANK_CLIENT (see product metrobank_client_prerequisite on GET /v1/reference/loan-products)',
      )
    } else if (!PERSONAL_LOAN_METROBANK_CLIENT_TYPES.includes(String(mt))) {
      errs.push(
        'metrobank_client_type must be one of: ' + PERSONAL_LOAN_METROBANK_CLIENT_TYPES.join(', '),
      )
    }
  }
  return errs
}
