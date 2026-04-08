import { buildUnderwritingBody, creditCheckForcePass } from '../../lib/sampleData.js'

/** Step 7 — **personal** applications need document registration before **submit**. */
export async function registerDocumentsForPayload(client, applicationId, payload) {
  await client.registerApplicationDocuments(applicationId, {
    primary_id_document_type: payload.borrower.primary_id_document_type,
  })
}

/**
 * **Step 7b** — when Step 6 PEP answers include **Yes**, sandbox requires **POST …/compliance/pep-clearance** before **submit**.
 */
export async function completePepComplianceGateIfRequired(client, applicationId, payload) {
  const ai = payload?.additional_information
  if (
    !ai ||
    typeof ai !== 'object' ||
    (ai.pep_close_family_or_public_position !== true &&
      ai.pep_financial_transactions_on_behalf !== true)
  ) {
    return
  }
  await client.completePepComplianceClearance(applicationId)
}

/** Ops queue + Reg-TILA-style disclosure ack (production-shaped gates before credit). */
export async function throughOpsAndDisclosures(client, applicationId) {
  await client.acceptForProcessing(applicationId)
  await client.acknowledgeDisclosures(applicationId)
}

/** Draft → submit → processing → disclosures → credit pass. */
export async function throughCredit(client, payload) {
  const created = await client.createApplication(payload)
  const appId = created.id
  await registerDocumentsForPayload(client, appId, payload)
  await completePepComplianceGateIfRequired(client, appId, payload)
  await client.submitApplication(appId)
  await throughOpsAndDisclosures(client, appId)
  await client.runCreditCheck(appId, creditCheckForcePass)
  return appId
}

/** After credit: enter underwriting queue, then post decision. */
export async function throughUnderwritingDecision(client, applicationId, uwPayload) {
  await client.startUnderwriting(applicationId)
  return client.underwritingDecision(applicationId, uwPayload)
}

/** Full path to ACTIVE loan (authorize → fund → disburse). */
export async function activeLoan(client, payload) {
  const appId = await throughCredit(client, payload)
  const out = await throughUnderwritingDecision(client, appId, buildUnderwritingBody('APPROVE'))
  const loanId = out.loan.id
  await client.authorizeFunding(loanId)
  await client.fundLoan(loanId)
  await client.disburseLoan(loanId)
  return [appId, loanId]
}
