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
      { month: '2025-03', balance: 200 },
    ])
  })
})
