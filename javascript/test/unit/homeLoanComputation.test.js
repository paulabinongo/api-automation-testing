import { describe, expect, it } from 'vitest'

import { computeHomeLoanPreview } from '../../lib/loan-products/home-loan/homeLoanComputation.js'

describe('computeHomeLoanPreview', () => {
  it('returns amortization using level annual rate bucket', () => {
    const out = computeHomeLoanPreview(10_000_000, 120, { loan_purpose: 'PURCHASE_HOUSE_AND_LOT' })
    expect(out).not.toBeNull()
    if (!out) return
    expect(out.product_code).toBe('HOME_LOAN')
    expect(out.annual_interest_percent_on_file).toBeGreaterThan(0)
    expect(out.monthly_amortization_cents).toBeGreaterThan(0)
  })

  it('uses Home Equity +1% tier when purpose is HOME_EQUITY_PERSONAL_CONSUMPTION', () => {
    const std = computeHomeLoanPreview(10_000_000, 60, { loan_purpose: 'PURCHASE_HOUSE_AND_LOT' })
    const eq = computeHomeLoanPreview(10_000_000, 60, {
      loan_purpose: 'HOME_EQUITY_PERSONAL_CONSUMPTION',
    })
    expect(std && eq).toBeTruthy()
    if (std && eq) {
      expect(eq.annual_interest_percent_on_file).toBeGreaterThan(
        std.annual_interest_percent_on_file,
      )
    }
  })
})
