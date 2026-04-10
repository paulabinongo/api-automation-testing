import {
  ALLOWED_LOAN_TERM_MONTHS,
  PAYMENT_METHODS,
  STIPULATION_DESCRIPTION_EXAMPLES,
} from './loanConstants.js'
import { METROBANK_DEPOSIT_REPAYMENT_PLAN } from './loanProductCatalog.js'

export { ALLOWED_LOAN_TERM_MONTHS, PAYMENT_METHODS, STIPULATION_DESCRIPTION_EXAMPLES }

/**
 * Example loan application — **PERSONAL_LOAN**, **PHP centavos** (see **GET /v1/reference/loan-products**).
 * **term_months** must be **12 | 18 | 24 | 36**.
 */
export function buildSampleLoanApplication() {
  return buildPersonalLoanSampleApplication(36)
}

const SAMPLE_MOBILE = '+639171234567'
const SAMPLE_HOME_APPRAISED = 100_000_000 // PHP 1,000,000
const SAMPLE_HOME_PRINCIPAL = 50_000_000 // PHP 500,000 (min scenario LTV 50% of 1M)

/**
 * **HOME_LOAN** sample — residential mortgage intake (PHP centavos). **Passport**-friendly ID number.
 * @param {number} [termMonths=240]
 */
export function buildHomeLoanSampleApplication(termMonths = 240) {
  const grossMonthlyIncomeCents = 5_000_000 // PHP 50,000 / month
  return {
    product_code: 'HOME_LOAN',
    principal_cents: SAMPLE_HOME_PRINCIPAL,
    term_months: termMonths,
    loan_purpose: 'PURCHASE_HOUSE_AND_LOT',
    additional_information: {
      pep_close_family_or_public_position: false,
      pep_financial_transactions_on_behalf: false,
      property_appraised_value_cents: SAMPLE_HOME_APPRAISED,
      home_loan_applicant_category: 'RESIDENT',
      collateral_property_type: 'RESIDENTIAL',
      collateral_is_vacant_lot: false,
      no_adverse_credit_history: true,
    },
    borrower: {
      first_name: 'Juan',
      middle_name: 'Dela',
      last_name: 'Cruz',
      full_name: 'Juan Dela Cruz',
      email: 'juan.delacruz@example.com',
      mobile_phone: SAMPLE_MOBILE,
      date_of_birth: '1988-03-20',
      citizenship: 'FILIPINO',
      primary_id_document_type: 'PASSPORT',
      primary_id_document_number: 'P1234567A',
      consents: {
        terms_of_use_accepted: true,
        terms_and_conditions_accepted: true,
        data_privacy_policy_accepted: true,
      },
      gender: 'MALE',
      marital_status: 'MARRIED',
      education: 'COLLEGE_GRADUATE',
      place_of_birth: 'Quezon City',
      mailing_same_as_residential: true,
      residential_address: {
        street_line: 'Mabini Street',
        subdivision_village: 'Sample Village',
        province: 'NCR',
        city_town: 'Makati',
        barangay: 'San Antonio',
        postal_code: '1200',
        home_ownership: 'OWNED',
      },
    },
    employment: {
      status: 'EMPLOYED',
      source_of_funds: 'EMPLOYED',
      employment_status: 'REGULAR',
      occupation: 'OFFICE_CLERK',
      industry: 'Real Estate',
      business_email: 'payroll@samplecorp.example.com',
      years_working_total: 12,
      gross_monthly_income_cents: grossMonthlyIncomeCents,
      employer_name: 'Sample Realty Corp',
      employer_address: {
        street_line: 'Ayala Avenue',
        subdivision_building: 'Tower One',
        province: 'NCR',
        city_town: 'Makati',
        barangay: 'Bel-Air',
        postal_code: '1209',
      },
      years_with_current_employer: 5,
      is_regular_employment: true,
    },
  }
}

const SAMPLE_ID_NUM = '12345678901'

/**
 * **PERSONAL_LOAN** sample — **principal_cents** and **employment.gross_monthly_income_cents** are **PHP centavos** (gross monthly × 12 ≥ PHP 250,000/year).
 * Principal within **PHP 20,000**–**2,000,000** (whole pesos). Mirrors Metrobank-style intake (loan purpose, PEP, consents, Step 3 ID subset, employment LOVs).
 * @param {number} [termMonths=36] one of **12 | 18 | 24 | 36**
 */
export function buildPersonalLoanSampleApplication(termMonths = 36) {
  const grossMonthlyIncomeCents = Math.floor(40_000_000 / 12)
  return {
    product_code: 'PERSONAL_LOAN',
    principal_cents: 50_000_000,
    term_months: termMonths,
    metrobank_client_type: 'EXISTING_CLIENT_DEPOSIT_ACCOUNT',
    loan_purpose: 'PERSONAL_CONSUMPTION',
    additional_information: {
      pep_close_family_or_public_position: false,
      pep_financial_transactions_on_behalf: false,
    },
    borrower: {
      first_name: 'Maria',
      middle_name: 'Ana',
      last_name: 'Santos',
      full_name: 'Maria Ana Santos',
      email: 'maria.santos@example.com',
      mobile_phone: SAMPLE_MOBILE,
      date_of_birth: '1990-06-15',
      citizenship: 'FILIPINO',
      primary_id_document_type: 'SSS',
      primary_id_document_number: SAMPLE_ID_NUM,
      consents: {
        terms_of_use_accepted: true,
        terms_and_conditions_accepted: true,
        data_privacy_policy_accepted: true,
      },
      gender: 'FEMALE',
      marital_status: 'MARRIED',
      education: 'COLLEGE_GRADUATE',
      place_of_birth: 'Makati',
      mailing_same_as_residential: true,
      residential_address: {
        street_line: 'Rizal Street',
        subdivision_village: 'Greenwoods Subdivision',
        province: 'NCR',
        city_town: 'Makati',
        barangay: 'San Antonio',
        postal_code: '1200',
        home_ownership: 'OWNED',
      },
      home_phone: {
        area_code: '082',
        subscriber_number: '12345678',
      },
    },
    employment: {
      status: 'EMPLOYED',
      source_of_funds: 'EMPLOYED',
      employment_status: 'REGULAR',
      occupation: 'OFFICE_CLERK',
      industry: 'Financial Services',
      business_email: 'hr@sampleemployer.example.com',
      years_working_total: 10,
      gross_monthly_income_cents: grossMonthlyIncomeCents,
      employer_name: 'Sample Employer Inc.',
      employer_address: {
        street_line: 'Ayala Avenue',
        subdivision_building: 'Enterprise Tower',
        province: 'NCR',
        city_town: 'Makati',
        barangay: 'Bel-Air',
        postal_code: '1209',
      },
      years_with_current_employer: 3,
      is_regular_employment: true,
      business_mobile_phone: '+639181112233',
      business_phone: {
        area_code: '082',
        subscriber_number: '87654321',
      },
    },
  }
}

/**
 * Applicant **not yet** a Metrobank client but **willing to open** a Metrobank deposit account for **ADA** repayments.
 * After **POST …/documents**, **POST …/metrobank-deposit-account/confirm** sets **`metrobank_deposit_account_confirmed_at`** (required before **underwriting** **APPROVE**; **submit** does not require it).
 */
export function buildPersonalLoanSampleApplicationNotYetMetrobankClient(termMonths = 36) {
  const base = buildPersonalLoanSampleApplication(termMonths)
  return {
    ...base,
    metrobank_client_type: 'NOT_METROBANK_CLIENT',
    additional_information: {
      ...base.additional_information,
      metrobank_deposit_repayment_plan:
        METROBANK_DEPOSIT_REPAYMENT_PLAN.WILL_OPEN_METROBANK_DEPOSIT,
    },
  }
}

/**
 * **Metrobank credit card** client opening (or linking) a **deposit** account for **ADA** — same **`metrobank_deposit_repayment_plan`** + confirm step as **`NOT_METROBANK_CLIENT`** with **`WILL_OPEN_METROBANK_DEPOSIT`** (confirm before **APPROVE**, not before **submit**).
 */
export function buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit(termMonths = 36) {
  const base = buildPersonalLoanSampleApplication(termMonths)
  return {
    ...base,
    metrobank_client_type: 'EXISTING_CLIENT_CREDIT_CARD',
    additional_information: {
      ...base.additional_information,
      metrobank_deposit_repayment_plan:
        METROBANK_DEPOSIT_REPAYMENT_PLAN.WILL_OPEN_METROBANK_DEPOSIT,
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
