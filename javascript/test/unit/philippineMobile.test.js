import { describe, expect, it } from 'vitest'
import { normalizePhilippineMobileDigits } from '../../lib/loanProductCatalog.js'

describe('normalizePhilippineMobileDigits', () => {
  it('accepts Metrobank-style (+63) with parentheses', () => {
    expect(normalizePhilippineMobileDigits('(+63)9123456789')).toBe('9123456789')
  })

  it('accepts compact +639 and legacy 09 / 9', () => {
    expect(normalizePhilippineMobileDigits('+639123456789')).toBe('9123456789')
    expect(normalizePhilippineMobileDigits('09123456789')).toBe('9123456789')
    expect(normalizePhilippineMobileDigits('9123456789')).toBe('9123456789')
  })

  it('rejects invalid lengths or non-9 national prefix', () => {
    expect(normalizePhilippineMobileDigits('+628123456789')).toBeNull()
    expect(normalizePhilippineMobileDigits('+63912345678')).toBeNull()
  })
})
