import { describe, expect, it } from 'vitest'

import { evaluateHomeLoanEligibility } from '../../lib/loan-products/home-loan/homeLoanEligibility.js'
import { buildHomeLoanSampleApplication } from '../../lib/sampleData.js'

describe('evaluateHomeLoanEligibility', () => {
  const ref = new Date('2026-06-15T12:00:00.000Z')

  it('passes for buildHomeLoanSampleApplication', () => {
    const body = buildHomeLoanSampleApplication(240)
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(true)
    expect(out.failed_checks).toHaveLength(0)
  })

  it('fails when gross monthly income is below PHP 40,000', () => {
    const body = buildHomeLoanSampleApplication()
    body.employment.gross_monthly_income_cents = 3_000_000
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
    expect(out.failed_checks.some((s) => /40,000|family income/i.test(s))).toBe(true)
  })

  it('fails when employed tenure under 2 years', () => {
    const body = buildHomeLoanSampleApplication()
    body.employment.years_with_current_employer = 1
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when term exceeds purpose max for OFW', () => {
    const body = buildHomeLoanSampleApplication(300)
    body.additional_information.home_loan_applicant_category = 'OFW'
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails LTV when principal exceeds cap vs appraisal', () => {
    const body = buildHomeLoanSampleApplication(240)
    body.principal_cents = 90_000_000 // 900k vs 1M appraisal, 80% = 800k max
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })
})
