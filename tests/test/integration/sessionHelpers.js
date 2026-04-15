import { buildDemoKycPayload, buildDemoLogin } from '../../lib/sampleData.js'

/** Log in and finish KYC so loan APIs work (mock + tests). */
export async function loginAndCompleteKyc(client) {
  const auth = await client.login(buildDemoLogin())
  client.setAccessToken(auth.access_token)
  await client.completeKyc(buildDemoKycPayload())
}
