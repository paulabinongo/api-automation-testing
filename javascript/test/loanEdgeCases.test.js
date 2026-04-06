/**
 * “What should go wrong” checks — bad ids, wrong order, overpayment, etc.
 * These protect customers and bank rules in a real system.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { LoanApiClient } from '../loanApiClient.js'
import { getSettings, isLocalMockConfigured } from '../config.js'
import {
  buildDemoLogin,
  buildSampleLoanApplication,
  buildPaymentBody,
  buildUnderwritingBody,
  creditCheckForceFail,
  creditCheckForcePass,
} from '../sampleData.js'
import { expectRejectsWithStatus } from './helpers/assertions.js'
import { activeLoan, throughCredit, throughUnderwritingDecision } from './flowHelpers.js'
import { loginAndCompleteKyc } from './sessionHelpers.js'

const MOCK_BASE = 'https://api.loan.test/v1'
const APP = 'app-edge-001'
const LOAN = 'loan-edge-001'

describe('Edge cases (pretend API — still no server)', () => {
  let server

  beforeAll(() => {
    server = setupServer(
      http.post(`${MOCK_BASE}/auth/login`, () =>
        HttpResponse.json({
          access_token: 'msw-edge-token',
          token_type: 'Bearer',
          expires_in: 3600,
          user: { id: 'user-edge', email: 'e@e.com' },
        }),
      ),
      http.post(`${MOCK_BASE}/onboarding/kyc`, () =>
        HttpResponse.json({ kyc_id: 'kyc-edge', status: 'VERIFIED', message: 'ok' }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${APP}/submit`, () =>
        HttpResponse.json({ detail: 'Application not found' }, { status: 404 }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${APP}/underwriting/decision`, () =>
        HttpResponse.json(
          {
            detail:
              'Application must be IN_UNDERWRITING for decision (current: DRAFT). Call POST …/underwriting/start after credit-check.',
          },
          { status: 409 },
        ),
      ),
      http.post(`${MOCK_BASE}/loans/${LOAN}/fund`, () =>
        HttpResponse.json(
          {
            detail:
              'Loan must be CLEARED_FOR_BOOKING to fund (book on the ledger). Current: ACTIVE.',
          },
          { status: 409 },
        ),
      ),
      http.post(`${MOCK_BASE}/loans/${LOAN}/payments`, () =>
        HttpResponse.json({ detail: 'Payment exceeds balance' }, { status: 400 }),
      ),
      http.get(`${MOCK_BASE}/loans/${LOAN}`, () =>
        HttpResponse.json({ detail: 'Loan not found' }, { status: 404 }),
      ),
    )
    server.listen({ onUnhandledRequest: 'bypass' })
  })

  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('cannot submit a made-up application id', async () => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    await expectRejectsWithStatus(client.submitApplication(APP), 404)
  })

  it('cannot approve before credit is done', async () => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    await expectRejectsWithStatus(
      client.underwritingDecision(APP, buildUnderwritingBody('APPROVE')),
      409,
    )
  })

  it('cannot fund a loan in the wrong state', async () => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    await expectRejectsWithStatus(client.fundLoan(LOAN), 409)
  })

  it('cannot pay more than the remaining balance', async () => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    await expectRejectsWithStatus(client.recordPayment(LOAN, buildPaymentBody(1_000_000)), 400)
  })

  it('cannot load a loan that does not exist', async () => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    await expectRejectsWithStatus(client.getLoan(LOAN), 404)
  })
})

describe.skipIf(!isLocalMockConfigured())(
  'Live practice API — same checks hitting real HTTP',
  () => {
    let client

    beforeEach(async () => {
      client = new LoanApiClient()
      await loginAndCompleteKyc(client)
    })

    it('submit with unknown id → “not found”', async () => {
      await expectRejectsWithStatus(
        client.submitApplication('00000000-0000-0000-0000-000000000099'),
        404,
      )
    })

    it('submit twice → second time is rejected', async () => {
      const created = await client.createApplication(buildSampleLoanApplication())
      const appId = created.id
      await client.submitApplication(appId)
      await expectRejectsWithStatus(client.submitApplication(appId), 409)
    })

    it('approve before credit → rejected', async () => {
      const created = await client.createApplication(buildSampleLoanApplication())
      const appId = created.id
      await client.submitApplication(appId)
      await expectRejectsWithStatus(
        client.underwritingDecision(appId, buildUnderwritingBody('APPROVE')),
        409,
      )
    })

    it('credit fail → application declined, no loan', async () => {
      const created = await client.createApplication(buildSampleLoanApplication())
      const appId = created.id
      await client.submitApplication(appId)
      await client.acceptForProcessing(appId)
      await client.acknowledgeDisclosures(appId)
      const res = await client.runCreditCheck(appId, creditCheckForceFail)
      expect(res.status).toBe('DECLINED')
    })

    it('credit before disclosures acknowledged → rejected', async () => {
      const created = await client.createApplication(buildSampleLoanApplication())
      const appId = created.id
      await client.submitApplication(appId)
      await client.acceptForProcessing(appId)
      await expectRejectsWithStatus(client.runCreditCheck(appId, creditCheckForcePass), 409)
    })

    it('fund before funding authorization → rejected', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      const out = await throughUnderwritingDecision(client, appId, buildUnderwritingBody('APPROVE'))
      await expectRejectsWithStatus(client.fundLoan(out.loan.id), 409)
    })

    it('unknown loan id → not found', async () => {
      await expectRejectsWithStatus(client.getLoan('00000000-0000-0000-0000-000000000088'), 404)
    })

    it('fund twice → second time rejected', async () => {
      const [, loanId] = await activeLoan(client, buildSampleLoanApplication())
      await expectRejectsWithStatus(client.fundLoan(loanId), 409)
    })

    it('disburse before fund → rejected', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      const out = await throughUnderwritingDecision(client, appId, buildUnderwritingBody('APPROVE'))
      await expectRejectsWithStatus(client.disburseLoan(out.loan.id), 409)
    })

    it('payment after fund but before disburse → rejected', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      const out = await throughUnderwritingDecision(client, appId, buildUnderwritingBody('APPROVE'))
      const loanId = out.loan.id
      await client.authorizeFunding(loanId)
      await client.fundLoan(loanId)
      expect((await client.getLoan(loanId)).status).toBe('FUNDED')
      await expectRejectsWithStatus(client.recordPayment(loanId, buildPaymentBody(100)), 409)
    })

    it('disburse twice → second time rejected', async () => {
      const [, loanId] = await activeLoan(client, buildSampleLoanApplication())
      await expectRejectsWithStatus(client.disburseLoan(loanId), 409)
    })

    it('payment before funding → rejected', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      const out = await throughUnderwritingDecision(client, appId, buildUnderwritingBody('APPROVE'))
      const loanId = out.loan.id
      await expectRejectsWithStatus(client.recordPayment(loanId, buildPaymentBody(100)), 409)
    })

    it('pay more than balance → rejected', async () => {
      const [, loanId] = await activeLoan(client, buildSampleLoanApplication())
      const loan = await client.getLoan(loanId)
      const bal = Number(loan.balance_cents)
      await expectRejectsWithStatus(client.recordPayment(loanId, buildPaymentBody(bal + 1)), 400)
    })

    it('bad application data → validation error', async () => {
      const { baseUrl } = getSettings()
      const invalid = {
        product_code: 'X',
        principal_cents: 0,
        term_months: 12,
        borrower: { full_name: 'A', email: 'a@b.co', annual_income_cents: 1 },
      }
      const res = await fetch(`${baseUrl}/loan-applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify(invalid),
      })
      expect(res.status).toBe(422)
    })

    it('no more payments after paid in full', async () => {
      const [, loanId] = await activeLoan(client, buildSampleLoanApplication())
      const loan = await client.getLoan(loanId)
      await client.recordPayment(loanId, buildPaymentBody(Number(loan.balance_cents)))
      const final = await client.getLoan(loanId)
      expect(final.status).toBe('PAID_OFF')
      await expectRejectsWithStatus(client.recordPayment(loanId, buildPaymentBody(1)), 409)
    })

    it('payoff twice still ends closed (idempotent on mock)', async () => {
      const [, loanId] = await activeLoan(client, buildSampleLoanApplication())
      await client.payoffLoan(loanId)
      const again = await client.payoffLoan(loanId)
      expect(again.status).toBe('CLOSED')
      expect(again.balance_cents).toBe(0)
    })

    it('cannot fund while waiting on stipulations', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      const uw = await throughUnderwritingDecision(
        client,
        appId,
        buildUnderwritingBody('CONDITIONAL', [{ description: 'Bank statements' }]),
      )
      const loanId = uw.loan.id
      await expectRejectsWithStatus(client.fundLoan(loanId), 409)
    })

    it('fulfill-all when straight APPROVE → 409', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      await throughUnderwritingDecision(client, appId, buildUnderwritingBody('APPROVE'))
      await expectRejectsWithStatus(client.fulfillAllStipulations(appId), 409)
    })

    it('fulfill-all twice → second call 409', async () => {
      const appId = await throughCredit(client, buildSampleLoanApplication())
      await throughUnderwritingDecision(
        client,
        appId,
        buildUnderwritingBody('CONDITIONAL', [{ description: 'Bank statements' }]),
      )
      await client.fulfillAllStipulations(appId)
      await expectRejectsWithStatus(client.fulfillAllStipulations(appId), 409)
    })

    it('API without Bearer token → 401', async () => {
      const bare = new LoanApiClient()
      await expectRejectsWithStatus(bare.getLoan('00000000-0000-0000-0000-000000000088'), 401)
    })

    it('create application after login but before KYC → 403', async () => {
      const c = new LoanApiClient()
      const auth = await c.login(buildDemoLogin())
      c.setAccessToken(auth.access_token)
      await expectRejectsWithStatus(c.createApplication(buildSampleLoanApplication()), 403)
    })

    it('create application with term not in product LOV → 422', async () => {
      const bad = { ...buildSampleLoanApplication(), term_months: 48 }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('payment with unsupported method → 422', async () => {
      const [, loanId] = await activeLoan(client, buildSampleLoanApplication())
      await expectRejectsWithStatus(
        client.recordPayment(loanId, { amount_cents: 100, method: 'CASH' }),
        422,
      )
    })
  },
)
