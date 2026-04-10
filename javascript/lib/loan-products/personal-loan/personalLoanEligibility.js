/**
 * Personal Loan eligibility (Step 6 “Additional information” / pre–document-upload gate).
 * Pure checks — call after **validateApplicationAgainstCatalog** (intake shape + amounts).
 */

import { PERSONAL_LOAN_PRODUCT } from '../../loanProductCatalog.js'
import { addCalendarMonths, ageOnDate } from '../shared/borrowerAge.js'

/**
 * @param {object} body — same shape as **POST /loan-applications** (after catalogue validation)
 * @param {{ referenceDate?: Date }} [options] — pin “today” for tests
 * @returns {{ eligible: boolean, checks: { id: string, criterion: string, passed: boolean }[], failed_checks: string[] }}
 */
export function evaluatePersonalLoanEligibility(body, options = {}) {
  const refDate = options.referenceDate instanceof Date ? options.referenceDate : new Date()
  const checks = []

  const b = body.borrower
  const termMonths = Number(body.term_months)

  const okCitizen = b?.citizenship === 'FILIPINO'
  checks.push({
    id: 'filipino_citizen',
    criterion: 'Be a Filipino citizen',
    passed: okCitizen,
  })

  let okAge = false
  const dob = b?.date_of_birth
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(String(dob)) && Number.isFinite(termMonths)) {
    const ageApp = ageOnDate(dob, refDate)
    const maturity = addCalendarMonths(refDate, termMonths)
    const ageMat = ageOnDate(dob, maturity)
    okAge = ageApp >= 21 && ageMat <= 65 && Number.isFinite(ageApp) && Number.isFinite(ageMat)
  }
  checks.push({
    id: 'age_application_and_maturity',
    criterion:
      'Be at least 21 years old at the time of loan application and 65 years old upon loan maturity',
    passed: okAge,
  })

  const gmi = body.employment?.gross_monthly_income_cents
  const impliedAnnual = typeof gmi === 'number' && Number.isFinite(gmi) ? gmi * 12 : NaN
  const okIncome =
    Number.isFinite(impliedAnnual) && impliedAnnual >= PERSONAL_LOAN_PRODUCT.min_annual_income_cents
  checks.push({
    id: 'gross_monthly_income_minimum',
    criterion:
      'Have gross monthly income such that annualized income is at least PHP 250,000 (derived from employment.gross_monthly_income_cents × 12)',
    passed: okIncome,
  })

  const mt = String(body.metrobank_client_type || '')
  let okMb = false
  if (mt === 'EXISTING_CLIENT_DEPOSIT_ACCOUNT') {
    okMb = true
  } else if (mt === 'NOT_METROBANK_CLIENT' || mt === 'EXISTING_CLIENT_CREDIT_CARD') {
    // Intake may proceed without a deposit yet; **POST …/underwriting/decision** (**APPROVE** / **CONDITIONAL**)
    // stays **422** until **`metrobank_deposit_account_confirmed_at`** is set (or borrower switches to deposit client).
    okMb = true
  }
  checks.push({
    id: 'metrobank_deposit_for_ada',
    criterion:
      'Metrobank deposit account for ADA is required before approval — existing deposit client, or **POST …/metrobank-deposit-account/confirm** after **WILL_OPEN_METROBANK_DEPOSIT**',
    passed: okMb,
  })

  const emp = body.employment
  let okEmployment = false
  if (emp?.status === 'EMPLOYED') {
    okEmployment =
      emp.is_regular_employment === true && Number(emp.years_with_current_employer) >= 1
  } else if (emp?.status === 'SELF_EMPLOYED') {
    okEmployment = Number(emp.years_in_current_business) >= 2
  }
  checks.push({
    id: 'employment_tenure',
    criterion:
      'If employed: regular status with current employer for at least 1 year; if self-employed: at least 2 years in the current business',
    passed: okEmployment,
  })

  const eligible = checks.every((c) => c.passed)
  return {
    eligible,
    checks,
    failed_checks: checks.filter((c) => !c.passed).map((c) => c.criterion),
  }
}
