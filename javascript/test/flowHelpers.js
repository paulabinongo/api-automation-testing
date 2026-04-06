import { buildUnderwritingBody, creditCheckForcePass } from '../sampleData.js'

/** Ops queue + Reg-TILA-style disclosure ack (production-shaped gates before credit). */
export async function throughOpsAndDisclosures(client, applicationId) {
  await client.acceptForProcessing(applicationId)
  await client.acknowledgeDisclosures(applicationId)
}

/** Draft → submit → processing → disclosures → credit pass. */
export async function throughCredit(client, payload) {
  const created = await client.createApplication(payload)
  const appId = created.id
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
