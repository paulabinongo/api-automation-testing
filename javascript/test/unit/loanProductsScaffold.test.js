import { describe, expect, it } from 'vitest'

import {
  getLoanProductByCode,
  registeredLoanProductCodes,
} from '../../lib/loan-products/catalog.js'
import { computeLoanPreviewForProduct } from '../../lib/loan-products/computationRegistry.js'

describe('loan-products scaffold (catalog + computation dispatch)', () => {
  it('getLoanProductByCode returns catalogue row for PERSONAL_LOAN', () => {
    const p = getLoanProductByCode('PERSONAL_LOAN')
    expect(p?.product_code).toBe('PERSONAL_LOAN')
    expect(p?.product_loan_type).toBe('PERSONAL')
    expect(p?.loan_type).toBe('personal')
    expect(Array.isArray(p?.allowed_term_months)).toBe(true)
  })

  it('getLoanProductByCode is undefined for unknown codes', () => {
    expect(getLoanProductByCode('NOT_A_PRODUCT')).toBeUndefined()
  })

  it('registeredLoanProductCodes lists every catalogue key', () => {
    expect(registeredLoanProductCodes()).toEqual(
      expect.arrayContaining(['PERSONAL_LOAN', 'HOME_LOAN']),
    )
    const home = getLoanProductByCode('HOME_LOAN')
    expect(home?.product_loan_type).toBe('PERSONAL')
    expect(home?.loan_type).toBe('home')
  })

  it('computeLoanPreviewForProduct runs for registered PERSONAL_LOAN', () => {
    const out = computeLoanPreviewForProduct('PERSONAL_LOAN', 2_000_000, 12)
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.payload).toHaveProperty('product_code', 'PERSONAL_LOAN')
  })

  it('computeLoanPreviewForProduct fails for unregistered product_code', () => {
    const out = computeLoanPreviewForProduct('FICTIVE_LOAN', 2_000_000, 12)
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.errors.some((e) => /computationRegistry/i.test(e))).toBe(true)
    }
  })

  it('computeLoanPreviewForProduct runs for HOME_LOAN', () => {
    const out = computeLoanPreviewForProduct('HOME_LOAN', 50_000_000, 240, {
      loan_purpose: 'PURCHASE_HOUSE_AND_LOT',
    })
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.payload.product_code).toBe('HOME_LOAN')
  })
})
