import { describe, expect, it } from 'vitest'

import { validateApplicationAgainstCatalog } from '../../lib/loanProductCatalog.js'
import { evaluatePersonalLoanEligibility } from '../../lib/loan-products/personal-loan/personalLoanEligibility.js'
import { buildPersonalLoanSampleApplication } from '../../lib/sampleData.js'

function validPersonalLoanBody(termMonths = 24) {
  return buildPersonalLoanSampleApplication(termMonths)
}

const pepVariants = [
  {
    label: 'only pep_close_family_or_public_position',
    additional_information: {
      pep_close_family_or_public_position: true,
      pep_financial_transactions_on_behalf: false,
    },
  },
  {
    label: 'only pep_financial_transactions_on_behalf',
    additional_information: {
      pep_close_family_or_public_position: false,
      pep_financial_transactions_on_behalf: true,
    },
  },
  {
    label: 'both PEP booleans true',
    additional_information: {
      pep_close_family_or_public_position: true,
      pep_financial_transactions_on_behalf: true,
    },
  },
]

describe('PEP additional_information — catalogue + eligibility (submit still needs pep-clearance in mock)', () => {
  it.each(pepVariants)(
    'validateApplicationAgainstCatalog passes when $label',
    ({ additional_information }) => {
      const body = { ...validPersonalLoanBody(), additional_information }
      const errs = validateApplicationAgainstCatalog(body)
      expect(errs, errs.join('; ')).toEqual([])
    },
  )

  it.each(pepVariants)(
    'evaluatePersonalLoanEligibility unchanged when $label',
    ({ additional_information }) => {
      const body = { ...validPersonalLoanBody(), additional_information }
      const ref = new Date('2026-06-15T12:00:00.000Z')
      const withFalse = validPersonalLoanBody()
      const base = evaluatePersonalLoanEligibility(withFalse, { referenceDate: ref })
      const pep = evaluatePersonalLoanEligibility(body, { referenceDate: ref })
      expect(pep.eligible).toBe(base.eligible)
      expect(pep.failed_checks).toEqual(base.failed_checks)
    },
  )
})
