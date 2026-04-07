/**
 * Checks that the main loan journey works end-to-end — in plain terms:
 * apply → submit → credit OK → approve → send money → pay → close.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { LoanApiClient } from '../loanApiClient.js'
import { isLocalMockConfigured } from '../config.js'
import {
  buildConditionalUnderwritingExample,
  buildPersonalLoanSampleApplication,
  buildSampleLoanApplication,
  buildPaymentBody,
  buildUnderwritingBody,
  creditCheckForcePass,
} from '../sampleData.js'
import { loginAndCompleteKyc } from './sessionHelpers.js'
import { expectRejectsWithStatus } from './helpers/assertions.js'

const MOCK_BASE = 'https://api.loan.test/v1'

describe('Happy path (pretend API — fast, no server needed)', () => {
  const applicationId = 'app-7f3a2b1c'
  const loanId = 'loan-9d4e5f6a'
  let server

  beforeAll(() => {
    const sample = buildSampleLoanApplication()
    const principal = sample.principal_cents

    server = setupServer(
      http.post(`${MOCK_BASE}/auth/login`, () =>
        HttpResponse.json({
          access_token: 'msw-test-token',
          token_type: 'Bearer',
          expires_in: 3600,
          user: { id: 'user-msw', email: 'demo@loan.bank' },
        }),
      ),
      http.post(`${MOCK_BASE}/onboarding/kyc`, () =>
        HttpResponse.json({
          kyc_id: 'kyc-msw-1',
          status: 'VERIFIED',
          message: 'ok',
        }),
      ),
      http.post(`${MOCK_BASE}/loan-applications`, () =>
        HttpResponse.json(
          {
            id: applicationId,
            status: 'DRAFT',
            product_code: sample.product_code,
            principal_cents: principal,
          },
          { status: 201 },
        ),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/submit`, () =>
        HttpResponse.json({ id: applicationId, status: 'SUBMITTED' }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/processing/accept`, () =>
        HttpResponse.json({ id: applicationId, status: 'IN_PROCESSING' }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/disclosures/acknowledge`, () =>
        HttpResponse.json({
          id: applicationId,
          status: 'IN_PROCESSING',
          disclosures_acknowledged_at: '2026-01-01T00:00:00.000Z',
        }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/credit-check`, () =>
        HttpResponse.json({
          id: applicationId,
          status: 'CREDIT_COMPLETED',
          credit_reference_id: 'CR-MOCK123',
        }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/underwriting/start`, () =>
        HttpResponse.json({ id: applicationId, status: 'IN_UNDERWRITING' }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/underwriting/decision`, () =>
        HttpResponse.json({
          application: {
            id: applicationId,
            status: 'APPROVED_CLEAR_TO_CLOSE',
            loan_id: loanId,
          },
          loan: { id: loanId, status: 'PENDING_FUNDING', balance_cents: principal },
        }),
      ),
      http.post(`${MOCK_BASE}/loans/${loanId}/funding/authorize`, () =>
        HttpResponse.json({
          id: loanId,
          status: 'CLEARED_FOR_BOOKING',
          balance_cents: principal,
          funding_authorized_at: '2026-01-15',
        }),
      ),
      http.post(`${MOCK_BASE}/loans/${loanId}/fund`, () =>
        HttpResponse.json({
          id: loanId,
          status: 'FUNDED',
          balance_cents: principal,
          funded_at: '2026-01-15',
          disbursed_at: null,
        }),
      ),
      http.post(`${MOCK_BASE}/loans/${loanId}/disburse`, () =>
        HttpResponse.json({
          id: loanId,
          status: 'ACTIVE',
          balance_cents: principal,
          funded_at: '2026-01-15',
          disbursed_at: '2026-01-15',
        }),
      ),
      http.get(`${MOCK_BASE}/loans/${loanId}/payment-schedule`, () =>
        HttpResponse.json({ loan_id: loanId, term_months: 36, installments: [] }),
      ),
      http.get(`${MOCK_BASE}/loans/${loanId}`, () =>
        HttpResponse.json({ id: loanId, status: 'ACTIVE', balance_cents: principal }),
      ),
      http.post(`${MOCK_BASE}/loans/${loanId}/payments`, () =>
        HttpResponse.json({
          loan: { id: loanId, status: 'ACTIVE', balance_cents: principal - 1_000_000 },
          payment_amount_cents: 1_000_000,
          payment_method: 'ACH',
        }),
      ),
      http.post(`${MOCK_BASE}/loans/${loanId}/payoff`, () =>
        HttpResponse.json({ id: loanId, status: 'CLOSED', balance_cents: 0 }),
      ),
    )
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('walks through create → fund → payment → payoff', async () => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    const sample = buildSampleLoanApplication()

    const created = await client.createApplication(sample)
    expect(created.status).toBe('DRAFT')

    const submitted = await client.submitApplication(applicationId)
    expect(submitted.status).toBe('SUBMITTED')

    const proc = await client.acceptForProcessing(applicationId)
    expect(proc.status).toBe('IN_PROCESSING')
    const disc = await client.acknowledgeDisclosures(applicationId)
    expect(disc.disclosures_acknowledged_at).toBeTruthy()

    const credit = await client.runCreditCheck(applicationId, creditCheckForcePass)
    expect(credit.status).toBe('CREDIT_COMPLETED')

    const queued = await client.startUnderwriting(applicationId)
    expect(queued.status).toBe('IN_UNDERWRITING')

    const uw = await client.underwritingDecision(applicationId, buildUnderwritingBody('APPROVE'))
    expect(uw.loan.id).toBe(loanId)
    expect(uw.loan.status).toBe('PENDING_FUNDING')

    const cleared = await client.authorizeFunding(loanId)
    expect(cleared.status).toBe('CLEARED_FOR_BOOKING')

    const funded = await client.fundLoan(loanId)
    expect(funded.status).toBe('FUNDED')
    const disbursed = await client.disburseLoan(loanId)
    expect(disbursed.status).toBe('ACTIVE')

    const sched = await client.getPaymentSchedule(loanId)
    expect(sched.loan_id).toBe(loanId)

    const loan = await client.getLoan(loanId)
    expect(loan.status).toBe('ACTIVE')

    const pay = await client.recordPayment(loanId, buildPaymentBody(1_000_000))
    expect(pay.loan.balance_cents).toBe(49_000_000)

    const closed = await client.payoffLoan(loanId)
    expect(closed.status).toBe('CLOSED')
    expect(closed.balance_cents).toBe(0)
  })

  it('surfaces a clear error when the API rejects the request', async () => {
    server.use(
      http.post(`${MOCK_BASE}/loan-applications`, () =>
        HttpResponse.json({ detail: 'Invalid product_code' }, { status: 422 }),
      ),
    )
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    await expectRejectsWithStatus(client.createApplication(buildSampleLoanApplication()), 422)
  })
})

describe.skipIf(!isLocalMockConfigured())(
  'Live practice API on your machine (when LOAN_API_BASE_URL points at local mock)',
  () => {
    it('exposes health and loan product reference without a session', async () => {
      const client = new LoanApiClient()
      const health = await client.getHealth()
      expect(health.status).toBe('UP')
      expect(health.api_revision).toBeTruthy()
      const ref = await client.getLoanProductReference()
      expect(ref.products).toHaveLength(1)
      const personal = ref.products[0]
      expect(personal?.product_code).toBe('PERSONAL_LOAN')
      expect(personal?.currency).toBe('PHP')
      expect(personal?.loan_type).toBe('personal')
      expect(personal?.name).toBe('Personal Loan')
      expect(personal?.term_options?.length).toBe(4)
    })

    it('loan computation preview matches add-on model for PHP 20k × 12', async () => {
      const client = new LoanApiClient()
      const out = await client.getLoanComputationPreview({
        principal_cents: 2_000_000,
        term_months: 12,
      })
      expect(out.total_interest_cents).toBe(420_000)
      expect(out.monthly_amortization_cents).toBe(201_667)
      expect(out.net_loan_proceeds_cents).toBe(1_850_000)
    })

    it('loan computation preview from application matches borrower principal and term', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildPersonalLoanSampleApplication(24)
      const created = await client.createApplication(sample)
      const fromApp = await client.getLoanComputationPreviewForApplication(created.id)
      const fromRef = await client.getLoanComputationPreview({
        principal_cents: created.principal_cents,
        term_months: created.term_months,
      })
      expect(fromApp.application_id).toBe(created.id)
      expect(fromApp.monthly_amortization_cents).toBe(fromRef.monthly_amortization_cents)
      expect(fromApp.net_loan_proceeds_cents).toBe(fromRef.net_loan_proceeds_cents)
      expect(fromApp.effective_interest_rate_annual_percent).toBe(
        fromRef.effective_interest_rate_annual_percent,
      )
    })

    it('replays createApplication when Idempotency-Key and body match (bank retry semantics)', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildSampleLoanApplication()
      const key = randomUUID()
      const first = await client.createApplication(sample, { idempotencyKey: key })
      const second = await client.createApplication(sample, { idempotencyKey: key })
      expect(second.id).toBe(first.id)
      expect(second).toEqual(first)
    })

    it('returns 409 when Idempotency-Key is reused with a different body', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const key = randomUUID()
      const a = buildSampleLoanApplication()
      const b = { ...a, principal_cents: a.principal_cents + 1 }
      await client.createApplication(a, { idempotencyKey: key })
      await expectRejectsWithStatus(client.createApplication(b, { idempotencyKey: key }), 409)
    })

    it('accepts PERSONAL_LOAN when principal and income match the catalogue (PHP centavos)', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const created = await client.createApplication(buildPersonalLoanSampleApplication(24))
      expect(created.status).toBe('DRAFT')
      expect(created.product_code).toBe('PERSONAL_LOAN')
    })

    it('rejects PERSONAL_LOAN when annual income is below the catalogue minimum', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication()
      const bad = {
        ...base,
        borrower: { ...base.borrower, annual_income_cents: 1 },
      }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('rejects PERSONAL_LOAN when principal is below PHP 20,000', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication()
      const bad = { ...base, principal_cents: 1_000_000 }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('runs the full story against the real mock URLs', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildSampleLoanApplication()

      const created = await client.createApplication(sample)
      const appId = created.id
      await client.submitApplication(appId)
      await client.acceptForProcessing(appId)
      await client.acknowledgeDisclosures(appId)
      await client.runCreditCheck(appId, creditCheckForcePass)
      await client.startUnderwriting(appId)
      const out = await client.underwritingDecision(appId, buildUnderwritingBody('APPROVE'))
      const loanId = out.loan.id
      expect(out.application.status).toBe('APPROVED_CLEAR_TO_CLOSE')

      await client.authorizeFunding(loanId)
      await client.fundLoan(loanId)
      expect((await client.getLoan(loanId)).status).toBe('FUNDED')
      await client.disburseLoan(loanId)
      const loan = await client.getLoan(loanId)
      expect(loan.status).toBe('ACTIVE')

      const sched = await client.getPaymentSchedule(loanId)
      expect(sched.installments?.length).toBe(sample.term_months)

      await client.recordPayment(loanId, buildPaymentBody(loan.balance_cents))
      const final = await client.getLoan(loanId)
      expect(final.status).toBe('PAID_OFF')

      await client.payoffLoan(loanId)
      const closed = await client.getLoan(loanId)
      expect(closed.status).toBe('CLOSED')
    })

    it('conditional approval: single stipulation cleared via fulfill-all, then fund', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildSampleLoanApplication()
      const created = await client.createApplication(sample)
      const appId = created.id
      await client.submitApplication(appId)
      await client.acceptForProcessing(appId)
      await client.acknowledgeDisclosures(appId)
      await client.runCreditCheck(appId, creditCheckForcePass)
      await client.startUnderwriting(appId)

      const uw = await client.underwritingDecision(
        appId,
        buildUnderwritingBody('CONDITIONAL', [{ description: 'Proof of income (W-2)' }]),
      )
      const loanId = uw.loan.id
      expect(uw.application.status).toBe('APPROVED_CONDITIONAL')
      expect(uw.loan.status).toBe('PENDING_STIPS')

      const cleared = await client.fulfillAllStipulations(appId)
      expect(cleared.application.status).toBe('APPROVED_CLEAR_TO_CLOSE')
      expect(cleared.loan.status).toBe('PENDING_FUNDING')
      expect(cleared.fulfilled_stipulation_ids).toEqual([uw.application.stipulations[0].id])

      await client.authorizeFunding(loanId)
      await client.fundLoan(loanId)
      expect((await client.getLoan(loanId)).status).toBe('FUNDED')
      await client.disburseLoan(loanId)
      expect((await client.getLoan(loanId)).status).toBe('ACTIVE')
    })

    it('conditional approval: single stipulation cleared via per-stip fulfill endpoint', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildSampleLoanApplication()
      const created = await client.createApplication(sample)
      const appId = created.id
      await client.submitApplication(appId)
      await client.acceptForProcessing(appId)
      await client.acknowledgeDisclosures(appId)
      await client.runCreditCheck(appId, creditCheckForcePass)
      await client.startUnderwriting(appId)

      const uw = await client.underwritingDecision(
        appId,
        buildUnderwritingBody('CONDITIONAL', [{ description: 'Signed disclosures' }]),
      )
      const loanId = uw.loan.id
      expect(uw.application.stipulations).toHaveLength(1)

      const cleared = await client.fulfillStipulation(appId, uw.application.stipulations[0].id)
      expect(cleared.application.status).toBe('APPROVED_CLEAR_TO_CLOSE')
      expect(cleared.loan.status).toBe('PENDING_FUNDING')
      expect(cleared.application.stipulations[0].fulfilled).toBe(true)

      await client.authorizeFunding(loanId)
      await client.fundLoan(loanId)
      expect((await client.getLoan(loanId)).status).toBe('FUNDED')
    })

    it('conditional approval: fulfill-all clears multiple stips in one call', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildSampleLoanApplication()
      const created = await client.createApplication(sample)
      const appId = created.id
      await client.submitApplication(appId)
      await client.acceptForProcessing(appId)
      await client.acknowledgeDisclosures(appId)
      await client.runCreditCheck(appId, creditCheckForcePass)
      await client.startUnderwriting(appId)

      const uw = await client.underwritingDecision(appId, buildConditionalUnderwritingExample(5))
      const loanId = uw.loan.id
      expect(uw.application.stipulations).toHaveLength(5)
      const ids = uw.application.stipulations.map((s) => s.id)

      const cleared = await client.fulfillAllStipulations(appId)
      expect(cleared.fulfilled_stipulation_ids).toEqual(ids)
      expect(cleared.application.stipulations.every((s) => s.fulfilled)).toBe(true)
      expect(cleared.loan.status).toBe('PENDING_FUNDING')

      await client.authorizeFunding(loanId)
      await client.fundLoan(loanId)
      expect((await client.getLoan(loanId)).status).toBe('FUNDED')
    })
  },
)
