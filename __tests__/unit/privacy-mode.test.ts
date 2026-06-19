import { describe, it, expect } from 'vitest'
import { maskValue } from '@/components/providers/PrivacyMode'

describe('maskValue', () => {
  it('returns formatted currency when not private', () => {
    const result = maskValue(1234.5, false)
    expect(result).toContain('R$')
    expect(result).toContain('1.234')
  })

  it('returns placeholder when private, regardless of value', () => {
    expect(maskValue(1234.5, true)).toBe('R$ ••••')
    expect(maskValue(0, true)).toBe('R$ ••••')
    expect(maskValue(-100, true)).toBe('R$ ••••')
  })
})
