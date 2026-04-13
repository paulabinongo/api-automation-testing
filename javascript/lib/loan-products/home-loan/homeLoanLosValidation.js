/**
 * Metrobank Home Loan — LOS-style document and fee line validation (mock).
 * Aligns required document keys with **`HOME_LOAN_PRODUCT.loan_requirements`** and fee cent amounts with **`fees_and_charges`**.
 */

import { HOME_LOAN_PRODUCT } from './homeLoanCatalog.js'

/** @typedef {'METRO_MANILA' | 'OTHER'} HomeLoanPropertyRegion */

const PURPOSE_CONSTRUCTION_DOCS = new Set([
  'HOUSE_CONSTRUCTION_OWNED_LOT',
  'PURCHASE_LOT_AND_HOUSE_CONSTRUCTION',
  'RENOVATION_EXPANSION',
])

const PURPOSE_DEVELOPER_CTS = new Set(['PURCHASE_CONDOMINIUM', 'PURCHASE_TOWNHOUSE'])

/** PHP 3,000,000 in centavos — audited FS when principal exceeds */
export const HOME_LOAN_AUDITED_FS_PRINCIPAL_THRESHOLD_CENTS = 3_000_000 * 100

export const HOME_LOAN_DOC_KEYS = Object.freeze({
  PERSONAL_APPLICATION_FORM_SIGNED: 'doc_personal_application_form_signed',
  PERSONAL_GOVERNMENT_ID: 'doc_personal_government_id_provided',
  PERSONAL_MARRIAGE_CONTRACT_IF_APPLICABLE: 'doc_personal_marriage_contract_if_applicable',
  INCOME_EMPLOYED_COE_PAYSLIPS_OR_ITR: 'doc_income_employed_coe_payslips_or_itr',
  INCOME_SELF_EMPLOYED_DTI_SEC_BANK: 'doc_income_self_employed_dti_sec_permit_bank_6m',
  INCOME_SELF_EMPLOYED_AUDITED_FS_2Y: 'doc_income_self_employed_audited_financial_statements_2y',
  INCOME_OFW_LAND_PACK: 'doc_income_ofw_land_coec_remittance_or_payslips',
  INCOME_OFW_SEA_PACK: 'doc_income_ofw_sea_poea_contract_sea_service',
  COLLATERAL_TCT_OR_CCT: 'doc_collateral_tct_or_cct_copy',
  COLLATERAL_TAX_DECLARATION: 'doc_collateral_tax_declaration',
  COLLATERAL_CONSTRUCTION_PACKAGE: 'doc_collateral_construction_plans_bom_specs_if_applicable',
  COLLATERAL_DEVELOPER_CTS: 'doc_collateral_developer_cts_or_reservation_if_applicable',
})

/**
 * @param {object} row Application-shaped (**borrower**, **employment**, **additional_information**, **loan_purpose**, **principal_cents**)
 * @returns {string[]} Stable document key strings required before **submit** for this profile
 */
export function getRequiredHomeLoanDocumentKeys(row) {
  const keys = [
    HOME_LOAN_DOC_KEYS.PERSONAL_APPLICATION_FORM_SIGNED,
    HOME_LOAN_DOC_KEYS.PERSONAL_GOVERNMENT_ID,
    HOME_LOAN_DOC_KEYS.COLLATERAL_TCT_OR_CCT,
    HOME_LOAN_DOC_KEYS.COLLATERAL_TAX_DECLARATION,
  ]
  const marital = String(row.borrower?.marital_status || '')
  if (marital === 'MARRIED') {
    keys.push(HOME_LOAN_DOC_KEYS.PERSONAL_MARRIAGE_CONTRACT_IF_APPLICABLE)
  }

  const ai =
    row.additional_information && typeof row.additional_information === 'object'
      ? row.additional_information
      : {}
  const cat = String(ai.home_loan_applicant_category || '')
  const emp = row.employment && typeof row.employment === 'object' ? row.employment : {}
  const empStatus = String(emp.status || '')
  const principal = Number(row.principal_cents)
  const over3m =
    Number.isFinite(principal) && principal > HOME_LOAN_AUDITED_FS_PRINCIPAL_THRESHOLD_CENTS

  if (cat === 'RESIDENT') {
    if (empStatus === 'EMPLOYED') {
      keys.push(HOME_LOAN_DOC_KEYS.INCOME_EMPLOYED_COE_PAYSLIPS_OR_ITR)
    } else if (empStatus === 'SELF_EMPLOYED') {
      keys.push(HOME_LOAN_DOC_KEYS.INCOME_SELF_EMPLOYED_DTI_SEC_BANK)
      if (over3m) keys.push(HOME_LOAN_DOC_KEYS.INCOME_SELF_EMPLOYED_AUDITED_FS_2Y)
    }
  } else if (cat === 'OFW') {
    if (empStatus === 'SELF_EMPLOYED') {
      keys.push(HOME_LOAN_DOC_KEYS.INCOME_SELF_EMPLOYED_DTI_SEC_BANK)
      if (over3m) keys.push(HOME_LOAN_DOC_KEYS.INCOME_SELF_EMPLOYED_AUDITED_FS_2Y)
    } else if (String(ai.ofw_employment_basis) === 'LAND_BASED') {
      keys.push(HOME_LOAN_DOC_KEYS.INCOME_OFW_LAND_PACK)
    } else if (String(ai.ofw_employment_basis) === 'SEA_BASED') {
      keys.push(HOME_LOAN_DOC_KEYS.INCOME_OFW_SEA_PACK)
    }
  }

  const purpose = String(row.loan_purpose || '')
  if (PURPOSE_CONSTRUCTION_DOCS.has(purpose)) {
    keys.push(HOME_LOAN_DOC_KEYS.COLLATERAL_CONSTRUCTION_PACKAGE)
  }
  if (PURPOSE_DEVELOPER_CTS.has(purpose)) {
    keys.push(HOME_LOAN_DOC_KEYS.COLLATERAL_DEVELOPER_CTS)
  }

  return keys
}

/**
 * @param {Record<string, unknown>} checklist
 * @param {object} row
 * @returns {string[]} Error messages (empty if valid)
 */
export function validateHomeLoanDocumentChecklistAgainstProfile(checklist, row) {
  const required = getRequiredHomeLoanDocumentKeys(row)
  const errs = []
  if (!checklist || typeof checklist !== 'object') {
    return [
      'home_loan_document_checklist must be an object with boolean true for each required document line',
    ]
  }
  for (const k of required) {
    if (checklist[k] !== true) {
      errs.push(
        `home_loan_document_checklist.${k} must be true (Metrobank Home Loan LOS — required for this applicant profile)`,
      )
    }
  }
  return errs
}

/**
 * @param {HomeLoanPropertyRegion} region
 * @param {number} titleCount
 */
export function computeHomeLoanApplicationNonRefundableFees(region, titleCount) {
  const nonRef = HOME_LOAN_PRODUCT.fees_and_charges.application_non_refundable
  const appraisal =
    region === 'METRO_MANILA'
      ? nonRef.appraisal_fee_cents.metro_manila
      : nonRef.appraisal_fee_cents.countryside
  const tc = Number(titleCount)
  const count = Number.isFinite(tc) && tc >= 1 ? Math.floor(tc) : 1
  const perTitle = nonRef.title_investigation_per_title_cents
  const titleInvestigationCents = count * perTitle
  return {
    property_region: region,
    title_investigation_title_count: count,
    appraisal_fee_cents: appraisal,
    title_investigation_cents: titleInvestigationCents,
    total_application_fees_cents: appraisal + titleInvestigationCents,
  }
}

/**
 * @param {{ appraisal_fee_cents?: unknown, title_investigation_cents?: unknown }} payments
 * @param {ReturnType<typeof computeHomeLoanApplicationNonRefundableFees>} expected
 */
export function validateHomeLoanApplicationFeePayments(payments, expected) {
  const errs = []
  if (!payments || typeof payments !== 'object') {
    return [
      'home_loan_application_fee_payments object required for HOME_LOAN (appraisal + title investigation amounts in PHP centavos)',
    ]
  }
  const a = Number(payments.appraisal_fee_cents)
  const t = Number(payments.title_investigation_cents)
  if (a !== expected.appraisal_fee_cents) {
    errs.push(
      `home_loan_application_fee_payments.appraisal_fee_cents must be ${expected.appraisal_fee_cents} (${expected.property_region === 'METRO_MANILA' ? 'Metro Manila' : 'outside Metro Manila'} appraisal fee from catalogue)`,
    )
  }
  if (t !== expected.title_investigation_cents) {
    errs.push(
      `home_loan_application_fee_payments.title_investigation_cents must be ${expected.title_investigation_cents} (title_investigation_title_count ${expected.title_investigation_title_count} × catalogue per-title fee)`,
    )
  }
  return errs
}

/**
 * @param {object} body
 * @param {object} row Application row (**product_code** HOME_LOAN)
 * @returns {string[]}
 */
export function validateHomeLoanDocumentsPostBody(body, row) {
  const errs = []
  const checklist = body.home_loan_document_checklist
  errs.push(...validateHomeLoanDocumentChecklistAgainstProfile(checklist, row))

  const regionRaw = body.home_loan_property_region
  const region = String(regionRaw || '').trim()
  if (region !== 'METRO_MANILA' && region !== 'OTHER') {
    errs.push(
      'home_loan_property_region must be METRO_MANILA or OTHER (collateral / appraisal zone)',
    )
  }

  let titleCount = 1
  if (body.home_loan_title_investigation_title_count != null) {
    const n = Number(body.home_loan_title_investigation_title_count)
    if (!Number.isInteger(n) || n < 1) {
      errs.push('home_loan_title_investigation_title_count must be an integer >= 1')
    } else {
      titleCount = n
    }
  }

  if (region === 'METRO_MANILA' || region === 'OTHER') {
    const expected = computeHomeLoanApplicationNonRefundableFees(
      /** @type {HomeLoanPropertyRegion} */ (region),
      titleCount,
    )
    errs.push(
      ...validateHomeLoanApplicationFeePayments(body.home_loan_application_fee_payments, expected),
    )
  }
  return errs
}

/**
 * Booking / post-approval fee lines (before **funding/authorize**).
 * @param {number} notarialDocumentCount
 */
export function computeHomeLoanBookingFeeExpectations(notarialDocumentCount) {
  const after = HOME_LOAN_PRODUCT.fees_and_charges.after_approval
  const handling = after.handling_fee_cents
  const n = Number(notarialDocumentCount)
  const count = Number.isInteger(n) && n >= 1 ? n : 1
  const notarialCents = count * after.notarial_per_document_cents
  return {
    handling_fee_cents: handling,
    notarial_document_count: count,
    notarial_fee_cents: notarialCents,
  }
}

/**
 * @param {object} body
 * @returns {string[]}
 */
export function validateHomeLoanBookingFeesBody(body) {
  const errs = []
  if (!body || typeof body !== 'object') {
    return ['Request body required']
  }
  const rawCount = body.notarial_document_count
  const count = rawCount != null ? Number(rawCount) : 1
  if (!Number.isInteger(count) || count < 1) {
    errs.push('notarial_document_count must be an integer >= 1')
    return errs
  }
  const expected = computeHomeLoanBookingFeeExpectations(count)
  if (Number(body.handling_fee_cents) !== expected.handling_fee_cents) {
    errs.push(`handling_fee_cents must be ${expected.handling_fee_cents} (catalogue handling fee)`)
  }
  if (Number(body.notarial_document_count) !== expected.notarial_document_count) {
    errs.push(
      `notarial_document_count must be ${expected.notarial_document_count} (must match notarial fee calculation)`,
    )
  }
  if (Number(body.notarial_fee_cents) !== expected.notarial_fee_cents) {
    errs.push(
      `notarial_fee_cents must be ${expected.notarial_fee_cents} (notarial_document_count × catalogue per-document fee)`,
    )
  }
  if (body.dst_acknowledged !== true) {
    errs.push(
      'dst_acknowledged must be true (Documentary Stamp Tax — per BIR / branch; borrower acknowledges liability)',
    )
  }
  if (body.mri_insurance_acknowledged !== true) {
    errs.push(
      'mri_insurance_acknowledged must be true (Mortgage Redemption Insurance — quoted by insurer)',
    )
  }
  if (body.property_insurance_acknowledged !== true) {
    errs.push(
      'property_insurance_acknowledged must be true (property insurance — quoted by insurer)',
    )
  }
  return errs
}

/**
 * @param {object | undefined} recorded **home_loan_booking_fees** on application
 * @returns {boolean}
 */
export function hasValidHomeLoanBookingFeesRecorded(recorded) {
  if (!recorded || typeof recorded !== 'object') return false
  return recorded.recorded_at != null && String(recorded.recorded_at).length > 0
}
