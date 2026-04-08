import { describe, expect, it } from 'vitest'

import { evaluatePersonalLoanEligibility } from '../../lib/personalLoanEligibility.js'
import {
  buildPersonalLoanSampleApplication,
  buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit,
  buildPersonalLoanSampleApplicationNotYetMetrobankClient,
} from '../../lib/sampleData.js'

describe('evaluatePersonalLoanEligibility', () => {
  const ref = new Date('2026-06-15T12:00:00.000Z')

  it('passes for a typical eligible employed applicant', () => {
    const body = buildPersonalLoanSampleApplication(36)
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(true)
    expect(out.failed_checks).toHaveLength(0)
    expect(out.checks.length).toBe(5)
    expect(out.checks.every((c) => c.passed)).toBe(true)
  })

  it('passes NOT_METROBANK_CLIENT metrobank check regardless of repayment plan (approval gates deposit)', () => {
    const ok = buildPersonalLoanSampleApplicationNotYetMetrobankClient(36)
    expect(evaluatePersonalLoanEligibility(ok, { referenceDate: ref }).eligible).toBe(true)
    const declines = {
      ...ok,
      additional_information: {
        ...ok.additional_information,
        metrobank_deposit_repayment_plan: 'DECLINES_METROBANK_DEPOSIT',
      },
    }
    expect(evaluatePersonalLoanEligibility(declines, { referenceDate: ref }).eligible).toBe(true)
    const otherBank = {
      ...ok,
      additional_information: {
        ...ok.additional_information,
        metrobank_deposit_repayment_plan: 'WILL_USE_OTHER_BANK_DEPOSIT_ONLY',
      },
    }
    expect(evaluatePersonalLoanEligibility(otherBank, { referenceDate: ref }).eligible).toBe(true)
  })

  it('passes EXISTING_CLIENT_CREDIT_CARD metrobank check even when plan omitted (approval gates deposit)', () => {
    const ok = buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit(36)
    expect(evaluatePersonalLoanEligibility(ok, { referenceDate: ref }).eligible).toBe(true)
    const noPlan = { ...ok, additional_information: { ...ok.additional_information } }
    delete noPlan.additional_information.metrobank_deposit_repayment_plan
    expect(evaluatePersonalLoanEligibility(noPlan, { referenceDate: ref }).eligible).toBe(true)
  })

  it('fails when borrower is not Filipino', () => {
    const body = buildPersonalLoanSampleApplication()
    body.borrower.citizenship = 'US'
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
    expect(out.failed_checks.some((s) => /Filipino/i.test(s))).toBe(true)
  })

  it('fails when age is under 21 at application', () => {
    const body = buildPersonalLoanSampleApplication()
    body.borrower.date_of_birth = '2010-01-01'
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when age would exceed 65 at loan maturity', () => {
    const body = buildPersonalLoanSampleApplication(36)
    body.borrower.date_of_birth = '1960-01-01'
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when gross monthly income implies below PHP 250,000/year', () => {
    const body = buildPersonalLoanSampleApplication()
    body.employment.gross_monthly_income_cents = 100_000
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when employed but tenure under 1 year', () => {
    const body = buildPersonalLoanSampleApplication()
    body.employment.years_with_current_employer = 0
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('fails when employed but not regular status', () => {
    const body = buildPersonalLoanSampleApplication()
    body.employment.is_regular_employment = false
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
  })

  it('passes self-employed with 2+ years in business', () => {
    const body = buildPersonalLoanSampleApplication()
    body.employment = {
      status: 'SELF_EMPLOYED',
      business_name: 'Sari-Sari Store',
      years_in_current_business: 2,
      gross_monthly_income_cents: 3_333_333,
    }
    const out = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    expect(out.eligible).toBe(true)
  })
})
