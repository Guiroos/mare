import { describe, it, expect } from 'vitest'
import { toAmount, formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'

describe('toAmount', () => {
  it('converts Drizzle decimal strings to number', () => {
    expect(toAmount('1234.50')).toBe(1234.5)
    expect(toAmount('0')).toBe(0)
    expect(toAmount('-99.99')).toBe(-99.99)
    expect(toAmount('0.01')).toBe(0.01)
  })

  it('returns 0 for null', () => {
    expect(toAmount(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(toAmount(undefined)).toBe(0)
  })

  it('passes through numbers unchanged', () => {
    expect(toAmount(42)).toBe(42)
    expect(toAmount(0)).toBe(0)
    expect(toAmount(-5.5)).toBe(-5.5)
  })
})

describe('formatCurrency', () => {
  it('formats positive values in pt-BR BRL', () => {
    const result = formatCurrency(1234.5)
    expect(result).toContain('1.234')
    expect(result).toContain('50')
    expect(result).toContain('R$')
  })

  it('formats zero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
    expect(result).toContain('R$')
  })

  it('formats negative values with minus sign', () => {
    const result = formatCurrency(-99.99)
    expect(result).toContain('99')
    expect(result).toContain('R$')
    expect(result).toContain('-')
  })

  it('formats large values with thousand separator', () => {
    const result = formatCurrency(1000000)
    expect(result).toContain('1.000.000')
  })
})

describe('formatCurrencyShort', () => {
  it('formats thousands with k suffix', () => {
    expect(formatCurrencyShort(42900)).toBe('R$ 42,9k')
    expect(formatCurrencyShort(1000)).toBe('R$ 1k')
    expect(formatCurrencyShort(1500)).toBe('R$ 1,5k')
  })

  it('formats millions with M suffix', () => {
    expect(formatCurrencyShort(1200000)).toBe('R$ 1,2M')
    expect(formatCurrencyShort(1000000)).toBe('R$ 1M')
  })

  it('formats negative thousands', () => {
    expect(formatCurrencyShort(-42900)).toBe('-R$ 42,9k')
  })

  it('formats negative millions', () => {
    expect(formatCurrencyShort(-1200000)).toBe('-R$ 1,2M')
  })

  it('falls back to formatCurrency for values below 1000', () => {
    const result = formatCurrencyShort(100)
    expect(result).toContain('R$')
    expect(result).toContain('100')
  })
})
