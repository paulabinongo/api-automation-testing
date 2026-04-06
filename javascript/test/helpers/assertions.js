/**
 * Shared API test assertions — keeps error expectations consistent across tests.
 */
import { expect } from 'vitest'

/**
 * @param {unknown} promise
 * @param {number} statusCode
 */
export async function expectRejectsWithStatus(promise, statusCode) {
  await expect(promise).rejects.toMatchObject({
    name: 'LoanApiError',
    statusCode,
  })
}
