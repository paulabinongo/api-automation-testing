/**
 * Reads settings from your environment (same idea as a .env file).
 * You normally do not need to open this file for day-to-day testing.
 */
import 'dotenv/config'

export function getSettings() {
  const baseUrl = (process.env.LOAN_API_BASE_URL || 'https://api.loan.test/v1').replace(/\/$/, '')
  const apiKey = process.env.LOAN_API_KEY || null
  return { baseUrl, apiKey }
}

/** True when `LOAN_API_BASE_URL` points at this repo's mock on loopback (any port), e.g. `http://127.0.0.1:8765/v1`. */
export function isLocalMockConfigured() {
  const u = (process.env.LOAN_API_BASE_URL || '').replace(/\/$/, '')
  return /^https?:\/\/127\.0\.0\.1:\d+\/v1$/.test(u)
}
