import { describe, it, expect } from 'vitest'
import { buildBalanceEvolution } from '@/lib/queries/debtors'

describe('buildBalanceEvolution', () => {
  it('returns empty array when there are no entries', () => {
    expect(buildBalanceEvolution([])).toEqual([])
  })

  it("closes the month with the balance after its own last entry, not the next month's first", () => {
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 300, entryDate: '2025-01-10' },
      { type: 'payment', amount: 300, entryDate: '2025-02-10' },
    ])
    expect(result).toEqual([
      { month: '2025-01', balance: 300 },
      { month: '2025-02', balance: 0 },
    ])
  })

  it('accumulates two charges in the same month before the month turns', () => {
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 100, entryDate: '2025-01-10' },
      { type: 'charge', amount: 50, entryDate: '2025-01-20' },
      { type: 'charge', amount: 30, entryDate: '2025-02-05' },
      { type: 'payment', amount: 180, entryDate: '2025-03-02' },
    ])
    expect(result).toEqual([
      { month: '2025-01', balance: 150 },
      { month: '2025-02', balance: 180 },
      { month: '2025-03', balance: 0 },
    ])
  })

  it('applies adjustment sign directly to the balance', () => {
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 200, entryDate: '2025-01-05' },
      { type: 'adjustment', amount: -50, entryDate: '2025-01-15' },
    ])
    expect(result).toEqual([{ month: '2025-01', balance: 150 }])
  })

  it('sorts months even if entries arrive out of order', () => {
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 100, entryDate: '2025-03-01' },
      { type: 'charge', amount: 100, entryDate: '2025-01-01' },
    ])
    expect(result).toEqual([
      { month: '2025-01', balance: 100 },
      { month: '2025-02', balance: 100 },
      { month: '2025-03', balance: 200 },
    ])
  })

  it('repeats the previous balance in months without entries', () => {
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 300, entryDate: '2025-11-10' },
      { type: 'payment', amount: 300, entryDate: '2026-02-03' },
    ])
    expect(result).toEqual([
      { month: '2025-11', balance: 300 },
      { month: '2025-12', balance: 300 },
      { month: '2026-01', balance: 300 },
      { month: '2026-02', balance: 0 },
    ])
  })

  it('settles to an exact positive zero, without float residue', () => {
    // Em float: 0.3 - 0.1 - 0.2 = -2.7e-17, que o Intl formata como "-R$ 0,00"
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 0.3, entryDate: '2025-01-05' },
      { type: 'payment', amount: 0.1, entryDate: '2025-01-10' },
      { type: 'payment', amount: 0.2, entryDate: '2025-01-20' },
    ])
    expect(result).toEqual([{ month: '2025-01', balance: 0 }])
    expect(Object.is(result[0].balance, 0)).toBe(true)
  })

  it('keeps cent precision when accumulating across months', () => {
    const result = buildBalanceEvolution([
      { type: 'charge', amount: 0.1, entryDate: '2025-01-05' },
      { type: 'charge', amount: 0.2, entryDate: '2025-02-05' },
    ])
    expect(result).toEqual([
      { month: '2025-01', balance: 0.1 },
      { month: '2025-02', balance: 0.3 },
    ])
  })
})
