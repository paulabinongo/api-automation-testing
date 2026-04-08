import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES,
  PERSONAL_LOAN_PRODUCT,
  PERSONAL_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES,
  primaryIdDocumentTypeLabel,
} from '../../lib/loanProductCatalog.js'

const openApiSpec = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../../mock-server/openapi.json'),
    'utf8',
  ),
)

describe('Personal Loan primary ID LOV', () => {
  it('exposes 15 ID types aligned with intake (GSIS, SSS, TIN, … Others)', () => {
    expect(PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES).toHaveLength(15)
    expect(PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES).toEqual([
      'GSIS',
      'SSS',
      'TIN',
      'DRIVERS_LICENSE',
      'PASSPORT',
      'UMID',
      'PRC',
      'COMPANY_ID',
      'EO226',
      'VISA',
      'WORK_PERMIT',
      'POSTAL',
      'SENIOR',
      'VOTERS',
      'OTHERS',
    ])
  })

  it('catalogue primary_id_document_types pairs values with display labels', () => {
    const rows = PERSONAL_LOAN_PRODUCT.primary_id_document_types
    expect(rows).toHaveLength(15)
    const drivers = rows.find((r) => r.value === 'DRIVERS_LICENSE')
    expect(drivers?.label).toBe("Driver's License")
    expect(rows.find((r) => r.value === 'OTHERS')?.label).toBe('Others')
  })

  it('primaryIdDocumentTypeLabel covers known API codes', () => {
    expect(primaryIdDocumentTypeLabel('PRC')).toBe('PRC')
    expect(primaryIdDocumentTypeLabel('WORK_PERMIT')).toBe('Work Permit')
    expect(primaryIdDocumentTypeLabel('UNKNOWN_CODE')).toBe('UNKNOWN CODE')
  })

  it('OpenAPI PrimaryIdDocumentType enum matches full catalogue (Step 7 / PATCH)', () => {
    const enumVals = openApiSpec.components?.schemas?.PrimaryIdDocumentType?.enum
    expect(enumVals).toEqual([...PERSONAL_LOAN_PRIMARY_ID_DOCUMENT_TYPES])
  })

  it('OpenAPI Step3PrimaryIdDocumentType matches Step 3 subset (basic details only)', () => {
    const enumVals = openApiSpec.components?.schemas?.Step3PrimaryIdDocumentType?.enum
    expect(enumVals).toEqual([...PERSONAL_LOAN_STEP3_PRIMARY_ID_DOCUMENT_TYPES])
  })
})
