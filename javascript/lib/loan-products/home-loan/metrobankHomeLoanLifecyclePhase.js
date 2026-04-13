import { HOME_LOAN_PRODUCT } from './homeLoanCatalog.js'

/**
 * @param {number} phaseNum
 * @returns {string}
 */
function titleForPhase(phaseNum) {
  const row = HOME_LOAN_PRODUCT.metrobank_lifecycle_phases.find((p) => p.phase === phaseNum)
  return row ? row.title : ''
}

/**
 * Maps unified application/loan API state to Metrobank Home Loan business phases **1–6**
 * (same titles as **`metrobank_lifecycle_phases`** on **`GET /reference/loan-products`**).
 *
 * - **1** — DRAFT, document intake not complete (eligibility / pre-qualification).
 * - **2** — DRAFT, document intake complete (documentation & application).
 * - **3** — SUBMITTED … IN_UNDERWRITING (processing & appraisal / credit path).
 * - **4** — Approved through booking (**APPROVED_***, loan **PENDING_STIPS** | **PENDING_FUNDING** | **CLEARED_FOR_BOOKING**).
 * - **5** — **FUNDED** | **ACTIVE** | **PAID_OFF** (disbursement & repayment).
 * - **6** — **CLOSED** (maturity & closing).
 *
 * @param {object | null | undefined} applicationRow
 * @param {object | null | undefined} loanRow
 * @returns {{ phase: number, title: string } | null} **null** if not **HOME_LOAN** or **DECLINED**
 */
export function computeMetrobankHomeLoanLifecyclePhase(applicationRow, loanRow) {
  if (!applicationRow || applicationRow.product_code !== 'HOME_LOAN') return null
  const st = applicationRow.status
  if (st === 'DECLINED') return null

  const loan = loanRow && typeof loanRow === 'object' ? loanRow : null

  if (loan) {
    if (loan.status === 'CLOSED') {
      return { phase: 6, title: titleForPhase(6) }
    }
    if (['FUNDED', 'ACTIVE', 'PAID_OFF'].includes(loan.status)) {
      return { phase: 5, title: titleForPhase(5) }
    }
    if (['PENDING_STIPS', 'PENDING_FUNDING', 'CLEARED_FOR_BOOKING'].includes(loan.status)) {
      return { phase: 4, title: titleForPhase(4) }
    }
  }

  if (st === 'APPROVED_CLEAR_TO_CLOSE' || st === 'APPROVED_CONDITIONAL') {
    return { phase: 4, title: titleForPhase(4) }
  }
  if (['SUBMITTED', 'IN_PROCESSING', 'CREDIT_COMPLETED', 'IN_UNDERWRITING'].includes(st)) {
    return { phase: 3, title: titleForPhase(3) }
  }
  if (st === 'DRAFT') {
    const docDone = applicationRow.document_intake && applicationRow.document_intake.completed_at
    return docDone
      ? { phase: 2, title: titleForPhase(2) }
      : { phase: 1, title: titleForPhase(1) }
  }

  return null
}
