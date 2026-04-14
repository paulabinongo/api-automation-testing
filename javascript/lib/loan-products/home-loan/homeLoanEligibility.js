/**
 * Home Loan eligibility — mirrors catalogue **Loan Evaluation before Loan Approval** (mock rules).
 */

import {
  HOME_LOAN_CITIZENSHIP_ACCEPTED,
  HOME_LOAN_PRODUCT,
  homeLoanEffectiveLtvCapPercent,
  homeLoanMaxTermMonthsAllowed,
} from './homeLoanCatalog.js'
import { addCalendarMonths, ageOnDate } from '../shared/borrowerAge.js'

/**
 * **Metrobank public application form** sends **employment** with only **`gross_monthly_income_cents`**.
 * Eligibility uses income + LTV + term + ADA rules only (no tenure / age / credit checks on that path).
 *
 * @param {unknown} emp
 */
export function isHomeLoanEmploymentIncomeOnly(emp) {
  if (!emp || typeof emp !== 'object') return false
  const keys = Object.keys(emp).filter((k) => {
    const v = /** @type {Record<string, unknown>} */ (emp)[k]
    return v !== undefined && v !== null && v !== ''
  })
  return keys.length === 1 && keys[0] === 'gross_monthly_income_cents'
}

/**
 * @param {object} body
 * @param {Date} refDate
 */
export function evaluateHomeLoanEligibility(body, options = {}) {
  const refDate = options.referenceDate instanceof Date ? options.referenceDate : new Date()
  const checks = []

  const b = body.borrower
  const ai =
    body.additional_information && typeof body.additional_information === 'object'
      ? body.additional_information
      : /** @type {Record<string, never>} */ ({})

  const termMonths = Number(body.term_months)
  const incomeOnly = isHomeLoanEmploymentIncomeOnly(body.employment)

  const gmi = body.employment?.gross_monthly_income_cents
  const impliedAnnual = typeof gmi === 'number' && Number.isFinite(gmi) ? gmi * 12 : NaN
  const minAnnual = HOME_LOAN_PRODUCT.min_annual_income_cents
  const okIncome = Number.isFinite(impliedAnnual) && impliedAnnual >= minAnnual
  checks.push({
    id: 'gross_monthly_family_income',
    criterion:
      'Gross monthly family income at least PHP 40,000 (mock: employment.gross_monthly_income_cents × 12 ≥ min_annual_income_cents on product)',
    passed: okIncome,
  })

  const mt = String(body.metrobank_client_type || '')
  let okMb = false
  if (mt === 'EXISTING_CLIENT_DEPOSIT_ACCOUNT') {
    okMb = true
  } else if (mt === 'NOT_METROBANK_CLIENT' || mt === 'EXISTING_CLIENT_CREDIT_CARD') {
    okMb = true
  }
  checks.push({
    id: 'metrobank_deposit_for_ada',
    criterion:
      'Metrobank deposit account for ADA is required before approval — existing deposit client, or **POST …/metrobank-deposit-account/confirm** after **WILL_OPEN_METROBANK_DEPOSIT**',
    passed: okMb,
  })

  const isOfwCat = String(ai.home_loan_applicant_category || '') === 'OFW'
  const vacantLot = ai.collateral_is_vacant_lot === true
  const homeEquityImprove =
    body.loan_purpose === 'HOME_EQUITY_PERSONAL_CONSUMPTION' &&
    ai.home_equity_for_improvement === true

  const maxTerm = homeLoanMaxTermMonthsAllowed(String(body.loan_purpose), isOfwCat, vacantLot, {
    home_equity_for_improvement: homeEquityImprove,
  })
  const okTerm =
    Number.isFinite(termMonths) && termMonths > 0 && termMonths <= maxTerm && maxTerm > 0
  checks.push({
    id: 'term_within_purpose_cap',
    criterion: `Term must not exceed maximum months for loan purpose, applicant category (resident/OFW), and vacant-lot rules (max ${maxTerm} for current selection)`,
    passed: okTerm,
  })

  const appraised = ai.property_appraised_value_cents
  const principal = Number(body.principal_cents)
  const ltvCap = homeLoanEffectiveLtvCapPercent(String(body.loan_purpose))
  const okLtv =
    typeof appraised === 'number' &&
    appraised > 0 &&
    Number.isFinite(principal) &&
    principal <= Math.floor((appraised * ltvCap) / 100)
  checks.push({
    id: 'ltv_vs_appraisal',
    criterion: `Loan principal must not exceed ${ltvCap}% of property_appraised_value_cents (catalogue LTV for this purpose)`,
    passed: okLtv,
  })

  if (incomeOnly) {
    const eligible = checks.every((c) => c.passed)
    return {
      eligible,
      checks,
      failed_checks: checks.filter((c) => !c.passed).map((c) => c.criterion),
    }
  }

  const cit = String(b?.citizenship || '')
  const okCitizen = HOME_LOAN_CITIZENSHIP_ACCEPTED.includes(/** @type {any} */ (cit))
  checks.push({
    id: 'citizenship_pre_qualification',
    criterion:
      'Citizenship: Filipino citizen or foreigner with permanent resident visa (borrower.citizenship)',
    passed: okCitizen,
  })

  let okAgeApp = false
  const dob = b?.date_of_birth
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(String(dob))) {
    const ageApp = ageOnDate(dob, refDate)
    okAgeApp = ageApp >= 21 && ageApp <= 65 && Number.isFinite(ageApp)
  }
  checks.push({
    id: 'age_at_application_21_to_65',
    criterion: 'Age between 21 and 65 at time of application (Metrobank pre-qualification)',
    passed: okAgeApp,
  })

  const emp = body.employment
  let okTenure = false
  if (!isOfwCat) {
    if (emp?.status === 'EMPLOYED') {
      okTenure = emp.is_regular_employment === true && Number(emp.years_with_current_employer) >= 2
    } else if (emp?.status === 'SELF_EMPLOYED') {
      okTenure = Number(emp.years_in_current_business) >= 3
    }
  } else if (emp?.status === 'SELF_EMPLOYED') {
    okTenure = Number(emp.years_in_current_business) >= 3
  } else if (String(ai.ofw_employment_basis) === 'LAND_BASED') {
    okTenure =
      emp?.status === 'EMPLOYED' &&
      emp.is_regular_employment === true &&
      Number(emp.years_with_current_employer) >= 2
  } else if (String(ai.ofw_employment_basis) === 'SEA_BASED') {
    okTenure = Number(ai.ofw_sea_contract_months_total) >= 24
  }
  checks.push({
    id: 'employment_or_business_tenure',
    criterion: isOfwCat
      ? 'OFW — Land-based: ≥2 years with current employer (regular). Sea-based: ≥24 months total contract. Self-employed OFW: ≥3 years in current business'
      : 'Resident — Employed: ≥2 years with current employer (regular). Self-employed: ≥3 years in current business',
    passed: okTenure,
  })

  const okCredit = ai.no_adverse_credit_history === true
  checks.push({
    id: 'no_adverse_credit',
    criterion:
      'Good credit — no adverse findings (additional_information.no_adverse_credit_history === true)',
    passed: okCredit,
  })

  let okMaturity = true
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(String(dob)) && Number.isFinite(termMonths)) {
    const maturity = addCalendarMonths(refDate, termMonths)
    const ageMat = ageOnDate(dob, maturity)
    okMaturity = Number.isFinite(ageMat) && ageMat <= 70
  }
  checks.push({
    id: 'age_at_maturity_max_70',
    criterion:
      'Borrower age at loan maturity not older than 70 (Metrobank-style cap; mock uses date_of_birth + term_months)',
    passed: okMaturity,
  })

  const eligible = checks.every((c) => c.passed)
  return {
    eligible,
    checks,
    failed_checks: checks.filter((c) => !c.passed).map((c) => c.criterion),
  }
}
