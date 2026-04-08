/**
 * Personal loan payment preview — add-on interest model aligned with typical PH disclosure:
 *
 * - **Total interest (PHP)** = `principal_php × (monthly_add_on_rate / 100) × term_months`
 * - **Monthly amortization (PHP)** = `(principal_php + total_interest_php) / term_months` (rounded to nearest centavo)
 * - **DST (PHP)** = `principal_php × 0.75%` if principal > PHP 250,000, else **0**
 * - **Total fees** = **disbursement_fee** + **DST**
 * - **Net loan proceeds** = `principal_php − total_fees_php`
 * - **Effective interest rate (EIR)** (annual %): solve monthly rate **r** from borrower cash flows:
 *   `net_proceeds = Σ monthly_amort / (1+r)^k` for k = 1..n, then **((1+r)^12 − 1) × 100**
 */
import { PERSONAL_LOAN_PRODUCT } from './loanProductCatalog.js'

/** @param {number} termMonths */
export function getPersonalLoanTermOption(termMonths) {
  const opt = PERSONAL_LOAN_PRODUCT.term_options.find((t) => t.term_months === termMonths)
  return opt ?? null
}

/** Present value of n payments of `payment` starting next period, monthly discount rate `r`. */
function pvOrdinaryAnnuity(r, n, payment) {
  if (r <= 0) return payment * n
  return (payment * (1 - (1 + r) ** -n)) / r
}

/**
 * Monthly IRR then annual effective % (borrower: +net at 0, −equal payments thereafter).
 * @param {number} netProceedsCents
 * @param {number} monthlyPaymentCents
 * @param {number} termMonths
 * @param {number} [maxIter]
 */
export function solveMonthlyIrrAnnualEirPercent(
  netProceedsCents,
  monthlyPaymentCents,
  termMonths,
  maxIter = 80,
) {
  /** PV(loan) − net proceeds; decreases in r; root where PV equals net. */
  const delta = (r) => pvOrdinaryAnnuity(r, termMonths, monthlyPaymentCents) - netProceedsCents

  let lo = 1e-10
  let hi = 0.08
  if (delta(lo) <= 0) return null
  let guard = 0
  while (delta(hi) > 0 && hi < 2 && guard < 40) {
    hi *= 1.25
    guard++
  }
  if (delta(hi) > 0) return null

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2
    if (delta(mid) > 0) lo = mid
    else hi = mid
  }
  const rMonth = (lo + hi) / 2
  const annualDec = (1 + rMonth) ** 12 - 1
  return Math.round(annualDec * 100_000) / 1000
}

/**
 * @param {number} principalCents PHP centavos (face / approved amount)
 * @param {number} termMonths 12 | 18 | 24 | 36
 */
export function computePersonalLoanPreview(principalCents, termMonths) {
  const termOpt = getPersonalLoanTermOption(termMonths)
  if (!termOpt) return null

  const addOn = termOpt.monthly_add_on_rate_percent
  /** Total interest in centavos — add-on applied each month on full principal. */
  const totalInterestCents = Math.round((principalCents * (addOn / 100) * termMonths) / 1)

  const totalRepaymentCents = principalCents + totalInterestCents
  const monthlyAmortizationCents = Math.round(totalRepaymentCents / termMonths)

  const { disbursement_fee_php, documentary_stamp_tax } = PERSONAL_LOAN_PRODUCT.fees_and_charges
  const disbursementCents = disbursement_fee_php * 100
  const principalPhp = principalCents / 100
  const dstCents =
    principalPhp > documentary_stamp_tax.threshold_principal_php
      ? Math.round((principalCents * documentary_stamp_tax.rate_percent) / 100)
      : 0

  const totalFeesCents = disbursementCents + dstCents
  const netLoanProceedsCents = principalCents - totalFeesCents

  const eir = solveMonthlyIrrAnnualEirPercent(
    netLoanProceedsCents,
    monthlyAmortizationCents,
    termMonths,
  )

  return {
    currency: 'PHP',
    product_code: PERSONAL_LOAN_PRODUCT.product_code,
    principal_cents: principalCents,
    term_months: termMonths,
    monthly_add_on_rate_percent: addOn,
    annual_contractual_rate_percent_on_file: termOpt.annual_contractual_rate_percent,
    formulas: {
      total_interest_php: 'principal_php × (monthly_add_on_rate_percent / 100) × term_months',
      monthly_amortization_php:
        '(principal_php + total_interest_php) / term_months (nearest centavo)',
      documentary_stamp_tax_php: 'principal_php × (0.75 / 100) if principal_php > 250,000 else 0',
      total_fees_php: 'disbursement_fee_php + documentary_stamp_tax_php',
      net_loan_proceeds_php: 'principal_php − total_fees_php',
      effective_interest_rate_annual_percent:
        'Solve monthly r: net_proceeds = PV(monthly_amort, r, n); EIR = ((1+r)^12 − 1) × 100',
    },
    total_interest_cents: totalInterestCents,
    monthly_amortization_cents: monthlyAmortizationCents,
    disbursement_fee_cents: disbursementCents,
    documentary_stamp_tax_cents: dstCents,
    total_fees_cents: totalFeesCents,
    net_loan_proceeds_cents: netLoanProceedsCents,
    effective_interest_rate_annual_percent: eir,
  }
}
