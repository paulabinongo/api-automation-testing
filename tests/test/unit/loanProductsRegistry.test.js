import { describe, expect, it } from 'vitest'

import { evaluateEligibilityForProduct } from '../../lib/loan-products/registry.js'
import { evaluateHomeLoanEligibility } from '../../lib/loan-products/home-loan/homeLoanEligibility.js'
import { evaluatePersonalLoanEligibility } from '../../lib/loan-products/personal-loan/personalLoanEligibility.js'
import {
  buildHomeLoanSampleApplication,
  buildPersonalLoanSampleApplication,
} from '../../lib/sampleData.js'

describe('evaluateEligibilityForProduct', () => {
  const ref = new Date('2026-06-15T12:00:00.000Z')

  it('dispatches PERSONAL_LOAN to the same result as evaluatePersonalLoanEligibility', () => {
    const body = buildPersonalLoanSampleApplication(36)
    const direct = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
    const viaRegistry = evaluateEligibilityForProduct(body, { referenceDate: ref })
    expect(viaRegistry).toEqual(direct)
  })

  it('returns a clear failure when product_code is missing', () => {
    const body = buildPersonalLoanSampleApplication(36)
    const noCode = { ...body }
    delete noCode.product_code
    const out = evaluateEligibilityForProduct(noCode, { referenceDate: ref })
    expect(out.eligible).toBe(false)
    expect(out.failed_checks.some((s) => /product_code/i.test(s))).toBe(true)
  })

  it('returns a clear failure for an unregistered product_code', () => {
    const body = { ...buildPersonalLoanSampleApplication(36), product_code: 'FICTIVE_LOAN' }
    const out = evaluateEligibilityForProduct(body, { referenceDate: ref })
    expect(out.eligible).toBe(false)
    expect(out.failed_checks.some((s) => /registry\.js/i.test(s))).toBe(true)
  })

  it('dispatches HOME_LOAN to evaluateHomeLoanEligibility', () => {
    const body = buildHomeLoanSampleApplication(240)
    const direct = evaluateHomeLoanEligibility(body, { referenceDate: ref })
    const viaRegistry = evaluateEligibilityForProduct(body, { referenceDate: ref })
    expect(viaRegistry).toEqual(direct)
  })
})
