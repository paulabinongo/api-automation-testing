/**
 * Home Loan payment preview — level **annual %** by lock-in bucket (years 1–5) with Home Equity +1% tier.
 */

import {
  HOME_LOAN_ANNUAL_RATES_BY_LOCK_IN_YEARS,
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
 * @param {number} termMonths
 * @param {boolean} useHomeEquityTier
 */
function annualPercentForTerm(termMonths, useHomeEquityTier) {
  const bucket = Math.min(5, Math.max(1, Math.ceil(termMonths / 12)))
  const row = HOME_LOAN_ANNUAL_RATES_BY_LOCK_IN_YEARS[bucket - 1]
  return useHomeEquityTier ? row.home_equity_annual_percent : row.annual_interest_percent
}

/**
 * @param {number} principalCents
 * @param {number} termMonths
 * @param {{ loan_purpose?: string }} [options]
 */
export function computeHomeLoanPreview(principalCents, termMonths, options = {}) {
  if (
    typeof principalCents !== 'number' ||
    !Number.isFinite(principalCents) ||
    principalCents <= 0 ||
    typeof termMonths !== 'number' ||
    !Number.isFinite(termMonths) ||
    termMonths < 12
  ) {
    return null
  }

  const purpose = options.loan_purpose
  const useHomeEquity =
    typeof purpose === 'string' &&
    HOME_LOAN_PURPOSE_DETAILS[/** @type {keyof typeof HOME_LOAN_PURPOSE_DETAILS} */ (purpose)]
      ?.uses_home_equity_rate_tier === true

  const annualPercent = annualPercentForTerm(termMonths, useHomeEquity)
  const monthlyAmortizationCents = levelMonthlyPaymentCents(
    principalCents,
    annualPercent,
    termMonths,
  )
  const totalRepaymentCents = monthlyAmortizationCents * termMonths
  const totalInterestCents = Math.max(0, totalRepaymentCents - principalCents)
  const lockYears = Math.min(5, Math.max(1, Math.ceil(termMonths / 12)))

  return {
    currency: 'PHP',
    product_code: HOME_LOAN_PRODUCT.product_code,
    principal_cents: principalCents,
    term_months: termMonths,
    loan_purpose_used: purpose ?? null,
    pricing_model: 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET',
    lock_in_pricing_years: lockYears,
    annual_interest_percent_on_file: annualPercent,
    monthly_amortization_cents: monthlyAmortizationCents,
    total_interest_cents: totalInterestCents,
    total_repayment_cents: totalRepaymentCents,
    formulas: Object.freeze({
      amortization:
        'Amortizing loan: monthly payment from level annual rate; bucket = min(5, ceil(term_months/12)); Home Equity purpose uses +1% tier per year row.',
      disclaimer:
        'Marketing rates apply the initial fixing bucket (1–5 years). At end of fixing, repricing follows Metrobank / market policy — not modeled as a separate API step.',
    }),
    fees_note:
      'Application: appraisal (PHP 4,000 NCR / PHP 4,500 countryside) + PHP 1,000 title investigation per title. After approval: PHP 5,000 handling, notarial, RD registration, MRI, and property insurance per quotes.',
  }
}
