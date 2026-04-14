import { describe, expect, it } from 'vitest'

import { evaluateHomeLoanEligibility } from '../../lib/loan-products/home-loan/homeLoanEligibility.js'
import { buildHomeLoanSampleApplication } from '../../lib/sampleData.js'

/**
 * Income-only intake skips age / tenure / citizenship / OFW contract checks. Use this for tests that assert those rules.
 * @param {ReturnType<typeof buildHomeLoanSampleApplication>} body
 * @param {{ borrower?: object, additional_information?: object, employment?: object }} [overrides]
 */
function homeLoanWithFullEligibilityFields(body, overrides = {}) {
  const out = structuredClone(body)
  out.borrower = {
    ...out.borrower,
    citizenship: 'FILIPINO',
    date_of_birth: out.borrower.date_of_birth || '1990-01-01',
    ...overrides.borrower,
  }
  out.additional_information = {
    ...out.additional_information,
    no_adverse_credit_history: true,
    ...overrides.additional_information,
  }
  out.employment = {
    ...out.employment,
    status: 'EMPLOYED',
    source_of_funds: 'EMPLOYED',
    employment_status: 'REGULAR',
    is_regular_employment: true,
    years_with_current_employer: 5,
    ...overrides.employment,
  }
  return out
}

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
    const body = homeLoanWithFullEligibilityFields(buildHomeLoanSampleApplication(), {
      employment: { years_with_current_employer: 1 },
    })
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when term exceeds purpose max for OFW', () => {
    const body = buildHomeLoanSampleApplication(300)
    body.additional_information.home_loan_applicant_category = 'OFW'
    body.additional_information.ofw_employment_basis = 'LAND_BASED'
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when applicant is over 65 at application date', () => {
    const body = homeLoanWithFullEligibilityFields(buildHomeLoanSampleApplication(240), {
      borrower: { date_of_birth: '1938-01-01' },
    })
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('passes for foreigner with permanent resident visa (same income/tenure)', () => {
    const body = homeLoanWithFullEligibilityFields(buildHomeLoanSampleApplication(240), {
      borrower: { citizenship: 'FOREIGNER_PERMANENT_RESIDENT' },
    })
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(true)
  })

  it('fails OFW sea-based when contract months under 24', () => {
    const body = homeLoanWithFullEligibilityFields(buildHomeLoanSampleApplication(180), {
      additional_information: {
        home_loan_applicant_category: 'OFW',
        ofw_employment_basis: 'SEA_BASED',
        ofw_sea_contract_months_total: 20,
      },
    })
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('passes OFW sea-based when contract months at least 24', () => {
    const body = homeLoanWithFullEligibilityFields(buildHomeLoanSampleApplication(180), {
      additional_information: {
        home_loan_applicant_category: 'OFW',
        ofw_employment_basis: 'SEA_BASED',
        ofw_sea_contract_months_total: 24,
      },
      employment: { years_with_current_employer: 0 },
    })
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(true)
  })

  it('fails LTV when principal exceeds cap vs appraisal', () => {
    const body = buildHomeLoanSampleApplication(240)
    body.principal_cents = 90_000_000 // 900k vs 1M appraisal, 80% = 800k max
    const out = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })
})
