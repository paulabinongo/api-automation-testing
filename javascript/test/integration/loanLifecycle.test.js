/**
 * Checks that the main loan journey works end-to-end — in plain terms:
 * apply → submit → credit OK → approve → send money → pay → close.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { LoanApiClient } from '../../lib/loanApiClient.js'
import { isLocalMockConfigured } from '../../lib/config.js'
import {
  buildConditionalUnderwritingExample,
  buildPersonalLoanSampleApplication,
  buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit,
  buildPersonalLoanSampleApplicationNotYetMetrobankClient,
  buildSampleLoanApplication,
  buildPaymentBody,
  buildUnderwritingBody,
  creditCheckForcePass,
} from '../../lib/sampleData.js'
import { loginAndCompleteKyc } from './sessionHelpers.js'
import {
  completePepComplianceGateIfRequired,
  registerDocumentsForPayload,
  throughCredit,
} from './flowHelpers.js'
import { expectRejectsWithStatus } from '../helpers/assertions.js'

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
      http.post(`${MOCK_BASE}/loan-applications`, async ({ request }) => {
        const body = await request.json()
        return HttpResponse.json(
          {
            id: applicationId,
            status: 'DRAFT',
            product_code: body.product_code,
            principal_cents: body.principal_cents,
            term_months: body.term_months,
            additional_information: body.additional_information,
          },
          { status: 201 },
        )
      }),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/documents`, () =>
        HttpResponse.json({
          id: applicationId,
          status: 'DRAFT',
          document_intake: {
            primary_id_document_type: sample.borrower.primary_id_document_type,
            completed_at: '2026-01-01T00:00:00.000Z',
          },
        }),
      ),
      http.post(`${MOCK_BASE}/loan-applications/${applicationId}/compliance/pep-clearance`, () =>
        HttpResponse.json({
          id: applicationId,
          status: 'DRAFT',
          pep_compliance_clearance_at: '2026-06-01T12:00:00.000Z',
        }),
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

    await registerDocumentsForPayload(client, applicationId, sample)

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

  it.each([
    [
      'pep_close_family_or_public_position only',
      { pep_close_family_or_public_position: true, pep_financial_transactions_on_behalf: false },
    ],
    [
      'pep_financial_transactions_on_behalf only',
      { pep_close_family_or_public_position: false, pep_financial_transactions_on_behalf: true },
    ],
    [
      'both PEP questions',
      { pep_close_family_or_public_position: true, pep_financial_transactions_on_behalf: true },
    ],
  ])('PEP Yes (%s): documents → pep-clearance → submit', async (_label, additional_information) => {
    const client = new LoanApiClient({ baseUrl: MOCK_BASE })
    await loginAndCompleteKyc(client)
    const body = { ...buildPersonalLoanSampleApplication(36), additional_information }
    const created = await client.createApplication(body)
    expect(created.status).toBe('DRAFT')
    expect(created.additional_information).toEqual(additional_information)
    await registerDocumentsForPayload(client, applicationId, body)
    await completePepComplianceGateIfRequired(client, applicationId, body)
    const submitted = await client.submitApplication(applicationId)
    expect(submitted.status).toBe('SUBMITTED')
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

    it.each([
      [
        'pep_close_family_or_public_position only',
        { pep_close_family_or_public_position: true, pep_financial_transactions_on_behalf: false },
      ],
      [
        'pep_financial_transactions_on_behalf only',
        { pep_close_family_or_public_position: false, pep_financial_transactions_on_behalf: true },
      ],
      [
        'both PEP questions',
        { pep_close_family_or_public_position: true, pep_financial_transactions_on_behalf: true },
      ],
    ])(
      'live mock: create + documents + pep-clearance + submit when %s is Yes',
      async (_label, additional_information) => {
        const client = new LoanApiClient()
        await loginAndCompleteKyc(client)
        const body = { ...buildPersonalLoanSampleApplication(12), additional_information }
        const created = await client.createApplication(body)
        expect(created.status).toBe('DRAFT')
        expect(created.additional_information).toEqual(additional_information)
        await registerDocumentsForPayload(client, created.id, body)
        await completePepComplianceGateIfRequired(client, created.id, body)
        const cleared = await client.getApplication(created.id)
        expect(cleared.pep_compliance_clearance_at).toBeTruthy()
        const submitted = await client.submitApplication(created.id)
        expect(submitted.status).toBe('SUBMITTED')
      },
    )

    it.each([
      [
        'one PEP flag',
        { pep_close_family_or_public_position: true, pep_financial_transactions_on_behalf: false },
      ],
      [
        'both PEP flags',
        { pep_close_family_or_public_position: true, pep_financial_transactions_on_behalf: true },
      ],
    ])(
      'live mock: eligibility-preview stays eligible when %s is Yes',
      async (_label, additional_information) => {
        const client = new LoanApiClient()
        await loginAndCompleteKyc(client)
        const body = { ...buildPersonalLoanSampleApplication(24), additional_information }
        const prev = await client.previewApplicationEligibility(body)
        expect(prev.eligible).toBe(true)
      },
    )

    it('live mock: submit returns 409 when PEP is Yes but compliance/pep-clearance was skipped', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = {
        ...buildPersonalLoanSampleApplication(12),
        additional_information: {
          pep_close_family_or_public_position: true,
          pep_financial_transactions_on_behalf: false,
        },
      }
      const created = await client.createApplication(body)
      await registerDocumentsForPayload(client, created.id, body)
      await expectRejectsWithStatus(client.submitApplication(created.id), 409)
    })

    it('live mock: POST compliance/pep-clearance returns 400 when neither PEP question is Yes', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplication(12)
      const created = await client.createApplication(body)
      await registerDocumentsForPayload(client, created.id, body)
      await expectRejectsWithStatus(client.completePepComplianceClearance(created.id), 400)
    })

    it('live mock: POST compliance/pep-clearance returns 409 before documents when PEP is Yes', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = {
        ...buildPersonalLoanSampleApplication(12),
        additional_information: {
          pep_close_family_or_public_position: false,
          pep_financial_transactions_on_behalf: true,
        },
      }
      const created = await client.createApplication(body)
      await expectRejectsWithStatus(client.completePepComplianceClearance(created.id), 409)
    })

    it('live mock: PATCH additional_information clears PEP clearance — submit blocks until pep-clearance again', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = {
        ...buildPersonalLoanSampleApplication(12),
        additional_information: {
          pep_close_family_or_public_position: true,
          pep_financial_transactions_on_behalf: false,
        },
      }
      const created = await client.createApplication(body)
      await registerDocumentsForPayload(client, created.id, body)
      await client.completePepComplianceClearance(created.id)
      await client.updateDraftApplication(created.id, {
        additional_information: {
          pep_close_family_or_public_position: true,
          pep_financial_transactions_on_behalf: true,
        },
      })
      await expectRejectsWithStatus(client.submitApplication(created.id), 409)
      await client.completePepComplianceClearance(created.id)
      const submitted = await client.submitApplication(created.id)
      expect(submitted.status).toBe('SUBMITTED')
    })

    it('rejects PERSONAL_LOAN when gross monthly income implies below minimum annual income', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication()
      const bad = {
        ...base,
        employment: { ...base.employment, gross_monthly_income_cents: 100 },
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

    it('accepts NOT_METROBANK_CLIENT when metrobank_deposit_repayment_plan is omitted', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const body = { ...base, metrobank_client_type: 'NOT_METROBANK_CLIENT' }
      const created = await client.createApplication(body)
      expect(created.status).toBe('DRAFT')
    })

    it('accepts NOT_METROBANK_CLIENT with WILL_OPEN_METROBANK_DEPOSIT plan', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplicationNotYetMetrobankClient(12)
      const created = await client.createApplication(body)
      expect(created.status).toBe('DRAFT')
    })

    it('accepts EXISTING_CLIENT_CREDIT_CARD when metrobank_deposit_repayment_plan is omitted', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const body = { ...base, metrobank_client_type: 'EXISTING_CLIENT_CREDIT_CARD' }
      const created = await client.createApplication(body)
      expect(created.status).toBe('DRAFT')
    })

    it('accepts EXISTING_CLIENT_CREDIT_CARD with WILL_OPEN_METROBANK_DEPOSIT plan', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit(12)
      const created = await client.createApplication(body)
      expect(created.status).toBe('DRAFT')
    })

    it('allows submit for EXISTING_CLIENT_CREDIT_CARD before metrobank-deposit confirm; confirm after submit unlocks APPROVE', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit(12)
      const created = await client.createApplication(body)
      await registerDocumentsForPayload(client, created.id, body)
      const submitted = await client.submitApplication(created.id)
      expect(submitted.status).toBe('SUBMITTED')
      await client.acceptForProcessing(created.id)
      await client.acknowledgeDisclosures(created.id)
      await client.runCreditCheck(created.id, creditCheckForcePass)
      await client.startUnderwriting(created.id)
      await expectRejectsWithStatus(
        client.underwritingDecision(created.id, buildUnderwritingBody('APPROVE')),
        422,
      )
      await client.confirmMetrobankDepositAccount(created.id)
      const uw = await client.underwritingDecision(created.id, buildUnderwritingBody('APPROVE'))
      expect(uw.application.status).toBe('APPROVED_CLEAR_TO_CLOSE')
      expect(uw.loan).toBeTruthy()
    })

    it('throughCredit works for EXISTING_CLIENT_CREDIT_CARD after confirm step', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const payload = buildPersonalLoanSampleApplicationCreditCardWillOpenDeposit(12)
      const appId = await throughCredit(client, payload)
      expect(appId).toBeTruthy()
    })

    it('allows submit for NOT_METROBANK_CLIENT before metrobank-deposit confirm; confirm after submit unlocks APPROVE', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplicationNotYetMetrobankClient(12)
      const created = await client.createApplication(body)
      await registerDocumentsForPayload(client, created.id, body)
      const submitted = await client.submitApplication(created.id)
      expect(submitted.status).toBe('SUBMITTED')
      await client.acceptForProcessing(created.id)
      await client.acknowledgeDisclosures(created.id)
      await client.runCreditCheck(created.id, creditCheckForcePass)
      await client.startUnderwriting(created.id)
      await expectRejectsWithStatus(
        client.underwritingDecision(created.id, buildUnderwritingBody('APPROVE')),
        422,
      )
      await client.confirmMetrobankDepositAccount(created.id)
      const uw = await client.underwritingDecision(created.id, buildUnderwritingBody('APPROVE'))
      expect(uw.application.status).toBe('APPROVED_CLEAR_TO_CLOSE')
      expect(uw.loan).toBeTruthy()
    })

    it('throughCredit works for NOT_METROBANK_CLIENT after confirm step', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const payload = buildPersonalLoanSampleApplicationNotYetMetrobankClient(12)
      const appId = await throughCredit(client, payload)
      expect(appId).toBeTruthy()
    })

    it('rejects create when primary_id is outside Step 3 subset (use PATCH then upload for PRC, etc.)', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const bad = {
        ...base,
        borrower: { ...base.borrower, primary_id_document_type: 'PRC' },
      }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('rejects borrower.middle_name with leading or trailing spaces', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const bad = {
        ...base,
        borrower: { ...base.borrower, middle_name: ' Ana ' },
      }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('rejects Present Home Address when Province/City/Barangay/ZIP do not match catalogue rows', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const bad = {
        ...base,
        borrower: {
          ...base.borrower,
          residential_address: {
            ...base.borrower.residential_address,
            barangay: 'Invalid Barangay Name',
          },
        },
      }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('rejects EMPLOYED intake when employment.employer_address is missing', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const { employer_address: _e, ...restEmp } = base.employment
      const bad = { ...base, employment: restEmp }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('rejects employment.employer_address when Province/City/Barangay/ZIP do not match catalogue', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const base = buildPersonalLoanSampleApplication(12)
      const bad = {
        ...base,
        employment: {
          ...base.employment,
          employer_address: {
            ...base.employment.employer_address,
            barangay: 'Not In Catalogue',
          },
        },
      }
      await expectRejectsWithStatus(client.createApplication(bad), 422)
    })

    it('loan product reference includes Metrobank client prerequisite for Personal Loan', async () => {
      const client = new LoanApiClient()
      const ref = await client.getLoanProductReference()
      const p = ref.products[0]
      expect(p?.metrobank_client_prerequisite?.question).toMatch(/repayment|Metrobank/i)
      expect(p?.metrobank_client_prerequisite?.explanation).toMatch(/Metrobank/i)
      expect(p?.metrobank_client_prerequisite?.choices?.length).toBe(3)
    })

    it('Personal Loan reference exposes intake_flow steps 1–7', async () => {
      const client = new LoanApiClient()
      const ref = await client.getLoanProductReference()
      const steps = ref.products[0]?.intake_flow?.steps
      expect(steps?.length).toBe(7)
      expect(steps?.[5]?.key).toBe('additional_information')
      expect(steps?.[6]?.key).toBe('document_requirements')
    })

    it('loan product reference exposes landline_area_code_options including 0882', async () => {
      const client = new LoanApiClient()
      const ref = await client.getLoanProductReference()
      const opts = ref.products[0]?.landline_area_code_options
      expect(Array.isArray(opts)).toBe(true)
      const values = opts.map((o) => o.value)
      expect(values).toContain('0882')
      expect(values).toContain('082')
      expect(values).toContain('002')
    })

    it('accepts home_phone and business_phone with area_code 0882', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplication(12)
      body.borrower.home_phone = { area_code: '0882', subscriber_number: '12345678' }
      body.employment.business_phone = { area_code: '0882', subscriber_number: '87654321' }
      const created = await client.createApplication(body)
      expect(created.status).toBe('DRAFT')
    })

    it('eligibility-preview returns eligible for full valid intake', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplication(24)
      const prev = await client.previewApplicationEligibility(body)
      expect(prev.eligible).toBe(true)
      expect(prev.checks?.length).toBe(5)
    })

    it('rejects create when eligibility fails (e.g. under 21)', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const body = buildPersonalLoanSampleApplication(12)
      body.borrower.date_of_birth = '2010-01-01'
      await expectRejectsWithStatus(client.createApplication(body), 422)
    })

    it('PATCH draft updates amounts when still valid and eligible', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const created = await client.createApplication(buildPersonalLoanSampleApplication(24))
      const nextPrincipal = created.principal_cents + 100
      const upd = await client.updateDraftApplication(created.id, {
        principal_cents: nextPrincipal,
      })
      expect(upd.principal_cents).toBe(nextPrincipal)
    })

    it('submit without document registration → 409 for Personal Loan', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildPersonalLoanSampleApplication(12)
      const created = await client.createApplication(sample)
      await expectRejectsWithStatus(client.submitApplication(created.id), 409)
    })

    it('document upload rejects when selected ID type does not match declared', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildPersonalLoanSampleApplication(12)
      const created = await client.createApplication(sample)
      await expectRejectsWithStatus(
        client.registerApplicationDocuments(created.id, { primary_id_document_type: 'TIN' }),
        422,
      )
    })

    it('after PATCH changes declared ID before upload, documents must match the new type', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildPersonalLoanSampleApplication(12)
      expect(sample.borrower.primary_id_document_type).toBe('SSS')
      const created = await client.createApplication(sample)
      await client.updateDraftApplication(created.id, {
        borrower: { primary_id_document_type: 'TIN' },
      })
      await expectRejectsWithStatus(
        client.registerApplicationDocuments(created.id, { primary_id_document_type: 'SSS' }),
        422,
      )
      await client.registerApplicationDocuments(created.id, { primary_id_document_type: 'TIN' })
      const ready = await client.getApplication(created.id)
      expect(ready.document_intake?.primary_id_document_type).toBe('TIN')
    })

    it('after PATCH changes declared ID, upload must use the new type', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildPersonalLoanSampleApplication(12)
      const created = await client.createApplication(sample)
      await client.registerApplicationDocuments(created.id, {
        primary_id_document_type: 'SSS',
      })
      await client.updateDraftApplication(created.id, {
        borrower: { primary_id_document_type: 'TIN' },
      })
      const refreshed = await client.getApplication(created.id)
      expect(refreshed.document_intake).toBeUndefined()
      await client.registerApplicationDocuments(created.id, {
        primary_id_document_type: 'TIN',
      })
      const done = await client.getApplication(created.id)
      expect(done.document_intake?.primary_id_document_type).toBe('TIN')
    })

    it('runs the full story against the real mock URLs', async () => {
      const client = new LoanApiClient()
      await loginAndCompleteKyc(client)
      const sample = buildSampleLoanApplication()

      const created = await client.createApplication(sample)
      const appId = created.id
      await registerDocumentsForPayload(client, appId, sample)
      await completePepComplianceGateIfRequired(client, appId, sample)
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
      await registerDocumentsForPayload(client, appId, sample)
      await completePepComplianceGateIfRequired(client, appId, sample)
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
      await registerDocumentsForPayload(client, appId, sample)
      await completePepComplianceGateIfRequired(client, appId, sample)
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
      await registerDocumentsForPayload(client, appId, sample)
      await completePepComplianceGateIfRequired(client, appId, sample)
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
