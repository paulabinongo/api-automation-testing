/**
 * Home Loan payment preview — level **annual %** by **interest fixing** bucket (1–5 years) with Home Equity +1% tier.
 * **Loan term** (amortization length, 1–25 years) is independent of the **initial fixing period** (Metrobank calculator UX).
 */

import {
  HOME_LOAN_ANNUAL_RATES_BY_LOCK_IN_YEARS,
  HOME_LOAN_MAX_TERM_YEARS,
  HOME_LOAN_MIN_TERM_YEARS,
  HOME_LOAN_PRODUCT,
  HOME_LOAN_PURPOSE_DETAILS,
} from './homeLoanCatalog.js'

/**
 * @param {number} principalCents
 * @param {number} annualPercent
 * @param {number} nMonths
 * @returns {number} monthly payment PHP centavos
 */
function levelMonthlyPaymentCents(principalCents, annualPercent, nMonths) {
  const principalPesos = principalCents / 100
  const r = annualPercent / 100 / 12
  if (nMonths < 1) return 0
  if (r === 0) return Math.round((principalPesos / nMonths) * 100)
  const factor = Math.pow(1 + r, nMonths)
  const payPesos = (principalPesos * r * factor) / (factor - 1)
  return Math.round(payPesos * 100)
}

/**
 * @param {number} lockYears 1–5 — **interest fixing** period (not loan tenor)
 * @param {boolean} useHomeEquityTier
 */
function annualPercentForFixing(lockYears, useHomeEquityTier) {
  const idx = Math.min(5, Math.max(1, lockYears)) - 1
  const row = HOME_LOAN_ANNUAL_RATES_BY_LOCK_IN_YEARS[idx]
  return useHomeEquityTier ? row.home_equity_annual_percent : row.annual_interest_percent
}

/**
 * @param {number} principalCents
 * @param {number} termMonths amortization tenor (**12–300** months = **1–25** years in **12**-month steps)
 * @param {{ loan_purpose?: string, interest_fixing_years?: number }} [options] `interest_fixing_years` **1–5** (defaults **1**); invalid → **null**
 */
export function computeHomeLoanPreview(principalCents, termMonths, options = {}) {
  const minM = HOME_LOAN_MIN_TERM_YEARS * 12
  const maxM = HOME_LOAN_MAX_TERM_YEARS * 12
  if (
    typeof principalCents !== 'number' ||
    !Number.isFinite(principalCents) ||
    principalCents <= 0 ||
    typeof termMonths !== 'number' ||
    !Number.isFinite(termMonths) ||
    termMonths < minM ||
    termMonths > maxM ||
    termMonths % 12 !== 0
  ) {
    return null
  }

  let fixingYears = options.interest_fixing_years
  if (fixingYears == null) fixingYears = 1
  if (typeof fixingYears !== 'number' || !Number.isInteger(fixingYears)) {
    return null
  }
  if (fixingYears < 1 || fixingYears > 5) {
    return null
  }

  const purpose = options.loan_purpose
  const useHomeEquity =
    typeof purpose === 'string' &&
    HOME_LOAN_PURPOSE_DETAILS[/** @type {keyof typeof HOME_LOAN_PURPOSE_DETAILS} */ (purpose)]
      ?.uses_home_equity_rate_tier === true

  const annualPercent = annualPercentForFixing(fixingYears, useHomeEquity)
  const monthlyAmortizationCents = levelMonthlyPaymentCents(
    principalCents,
    annualPercent,
    termMonths,
  )
  const totalRepaymentCents = monthlyAmortizationCents * termMonths
  const totalInterestCents = Math.max(0, totalRepaymentCents - principalCents)

  return {
    currency: 'PHP',
    product_code: HOME_LOAN_PRODUCT.product_code,
    principal_cents: principalCents,
    term_months: termMonths,
    loan_purpose_used: purpose ?? null,
    interest_fixing_years: fixingYears,
    pricing_model: 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET',
    lock_in_pricing_years: fixingYears,
    annual_interest_percent_on_file: annualPercent,
    monthly_amortization_cents: monthlyAmortizationCents,
    total_interest_cents: totalInterestCents,
    total_repayment_cents: totalRepaymentCents,
    formulas: Object.freeze({
      amortization:
        'Amortizing loan: monthly payment from level annual rate for the selected **interest fixing** period (**interest_fixing_years** 1–5). **term_months** is amortization length only (1–25 years); it does not select the rate bucket.',
      disclaimer:
        'Marketing rates apply the initial fixing bucket (1–5 years). At end of fixing, repricing follows Metrobank / market policy — not modeled as a separate API step.',
    }),
    fees_note:
      'Application: appraisal (PHP 4,000 NCR / PHP 4,500 countryside) + PHP 1,000 title investigation per title. After approval: PHP 5,000 handling, notarial, RD registration, MRI, and property insurance per quotes.',
  }
}
