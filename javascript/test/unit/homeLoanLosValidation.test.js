import { describe, expect, it } from 'vitest'

import { buildHomeLoanSampleApplication } from '../../lib/sampleData.js'
import {
  computeHomeLoanApplicationNonRefundableFees,
  computeHomeLoanBookingFeeExpectations,
  getRequiredHomeLoanDocumentKeys,
  HOME_LOAN_AUDITED_FS_PRINCIPAL_THRESHOLD_CENTS,
  HOME_LOAN_DOC_KEYS,
  validateHomeLoanBookingFeesBody,
  validateHomeLoanDocumentChecklistAgainstProfile,
} from '../../lib/loan-products/home-loan/homeLoanLosValidation.js'

describe('getRequiredHomeLoanDocumentKeys', () => {
  it('includes income and marriage for default sample (MARRIED, RESIDENT, EMPLOYED)', () => {
    const keys = getRequiredHomeLoanDocumentKeys(buildHomeLoanSampleApplication(240))
    expect(keys).toContain(HOME_LOAN_DOC_KEYS.PERSONAL_MARRIAGE_CONTRACT_IF_APPLICABLE)
    expect(keys).toContain(HOME_LOAN_DOC_KEYS.INCOME_EMPLOYED_COE_PAYSLIPS_OR_ITR)
    expect(keys).not.toContain(HOME_LOAN_DOC_KEYS.INCOME_SELF_EMPLOYED_AUDITED_FS_2Y)
  })

  it('requires audited FS when principal above PHP 3M', () => {
    const body = buildHomeLoanSampleApplication(240)
    body.principal_cents = HOME_LOAN_AUDITED_FS_PRINCIPAL_THRESHOLD_CENTS + 100
    body.employment = {
      ...body.employment,
      status: 'SELF_EMPLOYED',
      source_of_funds: 'SELF_EMPLOYED',
    }
    const keys = getRequiredHomeLoanDocumentKeys(body)
    expect(keys).toContain(HOME_LOAN_DOC_KEYS.INCOME_SELF_EMPLOYED_AUDITED_FS_2Y)
  })

  it('requires construction package for renovation purpose', () => {
    const body = buildHomeLoanSampleApplication(240)
    body.loan_purpose = 'RENOVATION_EXPANSION'
    const keys = getRequiredHomeLoanDocumentKeys(body)
    expect(keys).toContain(HOME_LOAN_DOC_KEYS.COLLATERAL_CONSTRUCTION_PACKAGE)
  })
})

describe('fees', () => {
  it('computes application non-refundable fees from catalogue', () => {
    const mm = computeHomeLoanApplicationNonRefundableFees('METRO_MANILA', 2)
    expect(mm.appraisal_fee_cents).toBe(4000 * 100)
    expect(mm.title_investigation_cents).toBe(1000 * 100 * 2)
    const o = computeHomeLoanApplicationNonRefundableFees('OTHER', 1)
    expect(o.appraisal_fee_cents).toBe(4500 * 100)
  })

  it('validates booking fee body', () => {
    const exp = computeHomeLoanBookingFeeExpectations(2)
    const errs = validateHomeLoanBookingFeesBody({
      handling_fee_cents: exp.handling_fee_cents,
      notarial_document_count: 2,
      notarial_fee_cents: exp.notarial_fee_cents,
      dst_acknowledged: true,
      mri_insurance_acknowledged: true,
      property_insurance_acknowledged: true,
    })
    expect(errs).toHaveLength(0)
  })
})

describe('validateHomeLoanDocumentChecklistAgainstProfile', () => {
  it('returns errors when a required key is false', () => {
    const body = buildHomeLoanSampleApplication(240)
    const required = getRequiredHomeLoanDocumentKeys(body)
    const checklist = Object.fromEntries(required.map((k) => [k, true]))
    checklist[required[0]] = false
    const errs = validateHomeLoanDocumentChecklistAgainstProfile(checklist, body)
    expect(errs.length).toBeGreaterThan(0)
  })
})
