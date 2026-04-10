/**
 * Home Loan eligibility — mirrors catalogue **Loan Evaluation before Loan Approval** (mock rules).
 */

import {
  HOME_LOAN_PRODUCT,
  homeLoanEffectiveLtvCapPercent,
  homeLoanMaxTermMonthsAllowed,
} from './homeLoanCatalog.js'
import { addCalendarMonths, ageOnDate } from '../shared/borrowerAge.js'

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

  const okCitizen = b?.citizenship === 'FILIPINO'
  checks.push({
    id: 'filipino_citizen',
    criterion: 'Filipino citizen (Home Loan intake)',
    passed: okCitizen,
  })

  const termMonths = Number(body.term_months)
  let okAge = false
  const dob = b?.date_of_birth
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(String(dob)) && Number.isFinite(termMonths)) {
    const ageApp = ageOnDate(dob, refDate)
    okAge = ageApp >= 21 && Number.isFinite(ageApp)
  }
  checks.push({
    id: 'minimum_age_21',
    criterion: 'Minimum age 21 at time of application',
    passed: okAge,
  })

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

  const emp = body.employment
  let okTenure = false
  if (emp?.status === 'EMPLOYED') {
    okTenure = emp.is_regular_employment === true && Number(emp.years_with_current_employer) >= 2
  } else if (emp?.status === 'SELF_EMPLOYED') {
    okTenure = Number(emp.years_in_current_business) >= 3
  }
  checks.push({
    id: 'employment_or_business_tenure',
    criterion:
      'Employed: at least 2 years with current employer (regular). Business: at least 3 years in current business',
    passed: okTenure,
  })

  const okCredit = ai.no_adverse_credit_history === true
  checks.push({
    id: 'no_adverse_credit',
    criterion:
      'Good credit — no adverse findings (additional_information.no_adverse_credit_history === true)',
    passed: okCredit,
  })

  const isOfw = String(ai.home_loan_applicant_category || '') === 'OFW'
  const vacantLot = ai.collateral_is_vacant_lot === true
  const homeEquityImprove =
    body.loan_purpose === 'HOME_EQUITY_PERSONAL_CONSUMPTION' &&
    ai.home_equity_for_improvement === true

  const maxTerm = homeLoanMaxTermMonthsAllowed(String(body.loan_purpose), isOfw, vacantLot, {
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

  let okMaturity = true
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(String(dob)) && Number.isFinite(termMonths)) {
    const maturity = addCalendarMonths(refDate, termMonths)
    const ageMat = ageOnDate(dob, maturity)
    okMaturity = Number.isFinite(ageMat) && ageMat <= 70
  }
  checks.push({
    id: 'age_upper_prudent_cap',
    criterion:
      'Borrower age at loan maturity ≤ 70 years (prudent sandbox cap — not in marketing sheet)',
    passed: okMaturity,
  })

  const eligible = checks.every((c) => c.passed)
  return {
    eligible,
    checks,
    failed_checks: checks.filter((c) => !c.passed).map((c) => c.criterion),
  }
}
