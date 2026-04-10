/**
 * Personal loan add-on + EIR formulas — matches disclosure-style calculator (PHP 20k × 12 mo).
 */
import { describe, expect, it } from 'vitest'

import {
  computePersonalLoanPreview,
  solveMonthlyIrrAnnualEirPercent,
} from '../../lib/loan-products/personal-loan/personalLoanComputation.js'

describe('computePersonalLoanPreview', () => {
  it('matches Metrobank-style 20,000 PHP × 12 months snapshot', () => {
    const out = computePersonalLoanPreview(2_000_000, 12)
    expect(out).not.toBeNull()
    expect(out.total_interest_cents).toBe(420_000)
    expect(out.monthly_amortization_cents).toBe(201_667)
    expect(out.disbursement_fee_cents).toBe(150_000)
    expect(out.documentary_stamp_tax_cents).toBe(0)
    expect(out.total_fees_cents).toBe(150_000)
    expect(out.net_loan_proceeds_cents).toBe(1_850_000)
    expect(out?.effective_interest_rate_annual_percent).toBeGreaterThan(67.4)
    expect(out?.effective_interest_rate_annual_percent).toBeLessThan(67.7)
  })

  it('applies DST when principal exceeds PHP 250,000', () => {
    const threeHundredKPesos = 30_000_000
    const out = computePersonalLoanPreview(threeHundredKPesos, 12)
    expect(out).not.toBeNull()
    expect(out?.documentary_stamp_tax_cents).toBe(225_000)
  })
})

describe('solveMonthlyIrrAnnualEirPercent', () => {
  it('returns null when no rate can reconcile PV', () => {
    expect(solveMonthlyIrrAnnualEirPercent(1_000_000, 1, 12)).toBeNull()
  })
})
