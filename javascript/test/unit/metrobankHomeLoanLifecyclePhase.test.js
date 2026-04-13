import { describe, expect, it } from 'vitest'

import { computeMetrobankHomeLoanLifecyclePhase } from '../../lib/loan-products/home-loan/metrobankHomeLoanLifecyclePhase.js'

function app(overrides) {
  return { product_code: 'HOME_LOAN', ...overrides }
}

describe('computeMetrobankHomeLoanLifecyclePhase', () => {
  it('returns null for non-HOME_LOAN', () => {
    expect(computeMetrobankHomeLoanLifecyclePhase({ product_code: 'PERSONAL_LOAN', status: 'DRAFT' }, null)).toBeNull()
  })

  it('returns null for DECLINED', () => {
    expect(
      computeMetrobankHomeLoanLifecyclePhase(app({ status: 'DECLINED', loan_id: null }), null),
    ).toBeNull()
  })

  it('phase 1 — DRAFT without document intake', () => {
    const r = computeMetrobankHomeLoanLifecyclePhase(app({ status: 'DRAFT', document_intake: null }), null)
    expect(r).toEqual({ phase: 1, title: 'Eligibility & Pre-Qualification' })
  })

  it('phase 2 — DRAFT with document intake complete', () => {
    const r = computeMetrobankHomeLoanLifecyclePhase(
      app({ status: 'DRAFT', document_intake: { completed_at: '2026-01-01T00:00:00.000Z' } }),
      null,
    )
    expect(r).toEqual({ phase: 2, title: 'Documentation & Application' })
  })

  it('phase 3 — SUBMITTED through IN_UNDERWRITING', () => {
    for (const st of ['SUBMITTED', 'IN_PROCESSING', 'CREDIT_COMPLETED', 'IN_UNDERWRITING']) {
      const r = computeMetrobankHomeLoanLifecyclePhase(app({ status: st, loan_id: null }), null)
      expect(r).toEqual({ phase: 3, title: 'Processing & Appraisal' })
    }
  })

  it('phase 4 — approved application statuses', () => {
    for (const st of ['APPROVED_CLEAR_TO_CLOSE', 'APPROVED_CONDITIONAL']) {
      const r = computeMetrobankHomeLoanLifecyclePhase(app({ status: st }), { status: 'PENDING_FUNDING' })
      expect(r).toEqual({ phase: 4, title: 'Approval & Loan Booking' })
    }
  })

  it('phase 4 — loan PENDING_STIPS / PENDING_FUNDING / CLEARED_FOR_BOOKING', () => {
    for (const ls of ['PENDING_STIPS', 'PENDING_FUNDING', 'CLEARED_FOR_BOOKING']) {
      const r = computeMetrobankHomeLoanLifecyclePhase(
        app({ status: 'APPROVED_CLEAR_TO_CLOSE', loan_id: 'x' }),
        { status: ls },
      )
      expect(r).toEqual({ phase: 4, title: 'Approval & Loan Booking' })
    }
  })

  it('phase 5 — FUNDED, ACTIVE, PAID_OFF', () => {
    for (const ls of ['FUNDED', 'ACTIVE', 'PAID_OFF']) {
      const r = computeMetrobankHomeLoanLifecyclePhase(
        app({ status: 'APPROVED_CLEAR_TO_CLOSE', loan_id: 'x' }),
        { status: ls },
      )
      expect(r).toEqual({ phase: 5, title: 'Disbursement & Repayment' })
    }
  })

  it('phase 6 — CLOSED', () => {
    const r = computeMetrobankHomeLoanLifecyclePhase(
      app({ status: 'APPROVED_CLEAR_TO_CLOSE', loan_id: 'x' }),
      { status: 'CLOSED' },
    )
    expect(r).toEqual({ phase: 6, title: 'Loan Maturity & Closing' })
  })

  it('loan status wins over application when CLOSED', () => {
    const r = computeMetrobankHomeLoanLifecyclePhase(
      app({ status: 'APPROVED_CLEAR_TO_CLOSE', loan_id: 'x' }),
      { status: 'CLOSED' },
    )
    expect(r?.phase).toBe(6)
  })
})
