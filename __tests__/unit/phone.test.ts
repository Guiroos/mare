import { describe, it, expect } from 'vitest'
import { formatPhoneForWhatsApp } from '@/lib/utils/phone'

describe('formatPhoneForWhatsApp', () => {
  it('strips non-digits and prepends 55', () => {
    expect(formatPhoneForWhatsApp('(11) 99999-9999')).toBe('5511999999999')
  })

  it('keeps number that already starts with 55', () => {
    expect(formatPhoneForWhatsApp('+55 (11) 99999-9999')).toBe('5511999999999')
  })

  it('replaces leading 0 with 55', () => {
    expect(formatPhoneForWhatsApp('011 99999-9999')).toBe('5511999999999')
  })

  it('handles already clean international number', () => {
    expect(formatPhoneForWhatsApp('5511987654321')).toBe('5511987654321')
  })

  it('handles number with spaces and dashes', () => {
    expect(formatPhoneForWhatsApp('11 9 8765-4321')).toBe('5511987654321')
  })
})
