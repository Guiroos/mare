import { describe, it, expect } from 'vitest'
import { buildPatrimonyTimeline } from '@/lib/queries/investments'

describe('buildPatrimonyTimeline', () => {
  it('returns empty array when there are no investments or withdrawals', () => {
    expect(buildPatrimonyTimeline([], [])).toEqual([])
  })

  it('accumulates a single investment entry with aporte and yield', () => {
    const result = buildPatrimonyTimeline(
      [{ referenceMonth: '2025-01-01', amount: '1000.00', yieldAmount: '50.00' }],
      []
    )
    expect(result).toEqual([{ month: '2025-01', total: 1050, aporte: 1000 }])
  })

  it('accumulates multiple months cumulatively', () => {
    const result = buildPatrimonyTimeline(
      [
        { referenceMonth: '2025-01-01', amount: '1000.00', yieldAmount: '10.00' },
        { referenceMonth: '2025-02-01', amount: '500.00', yieldAmount: '15.00' },
      ],
      []
    )
    expect(result).toEqual([
      { month: '2025-01', total: 1010, aporte: 1000 },
      { month: '2025-02', total: 1525, aporte: 1500 },
    ])
  })

  it('aggregates multiple investment types in the same month', () => {
    const result = buildPatrimonyTimeline(
      [
        { referenceMonth: '2025-01-01', amount: '1000.00', yieldAmount: '10.00' },
        { referenceMonth: '2025-01-01', amount: '500.00', yieldAmount: '5.00' },
      ],
      []
    )
    expect(result).toEqual([{ month: '2025-01', total: 1515, aporte: 1500 }])
  })

  it('handles null amount and yieldAmount as zero', () => {
    const result = buildPatrimonyTimeline(
      [{ referenceMonth: '2025-01-01', amount: null, yieldAmount: null }],
      []
    )
    expect(result).toEqual([{ month: '2025-01', total: 0, aporte: 0 }])
  })

  it('subtracts withdrawal gross (amount + tax) from both total and aporte', () => {
    const result = buildPatrimonyTimeline(
      [{ referenceMonth: '2025-01-01', amount: '10000.00', yieldAmount: '500.00' }],
      [{ date: '2025-02-15', amount: '9000.00', taxAmount: '200.00' }]
    )
    expect(result).toEqual([
      { month: '2025-01', total: 10500, aporte: 10000 },
      { month: '2025-02', total: 10500 - 9200, aporte: 10000 - 9200 },
    ])
  })

  it('handles withdrawal with null taxAmount as zero tax', () => {
    const result = buildPatrimonyTimeline(
      [{ referenceMonth: '2025-01-01', amount: '5000.00', yieldAmount: '0.00' }],
      [{ date: '2025-02-01', amount: '2000.00', taxAmount: null }]
    )
    expect(result).toEqual([
      { month: '2025-01', total: 5000, aporte: 5000 },
      { month: '2025-02', total: 3000, aporte: 3000 },
    ])
  })

  it('handles withdrawal in same month as investment', () => {
    const result = buildPatrimonyTimeline(
      [{ referenceMonth: '2025-01-01', amount: '1000.00', yieldAmount: '0.00' }],
      [{ date: '2025-01-20', amount: '400.00', taxAmount: '0.00' }]
    )
    expect(result).toEqual([{ month: '2025-01', total: 600, aporte: 600 }])
  })

  it('handles withdrawal month with no investment entries', () => {
    const result = buildPatrimonyTimeline(
      [{ referenceMonth: '2025-01-01', amount: '5000.00', yieldAmount: '200.00' }],
      [{ date: '2025-03-10', amount: '5200.00', taxAmount: '0.00' }]
    )
    expect(result).toEqual([
      { month: '2025-01', total: 5200, aporte: 5000 },
      { month: '2025-03', total: 0, aporte: -200 },
    ])
  })

  it('reinvestment scenario: recycled money does not inflate aporte', () => {
    // Old investment: R$10k in, R$2.3k yield → withdrawn gross R$12.3k
    // New investment: R$10k (from withdrawal proceeds)
    // Expected aporte: 10k + 10k - 12.3k = 7.7k (not 20k)
    const result = buildPatrimonyTimeline(
      [
        { referenceMonth: '2025-01-01', amount: '10000.00', yieldAmount: '2300.00' },
        { referenceMonth: '2025-06-01', amount: '10000.00', yieldAmount: '0.00' },
      ],
      [{ date: '2025-06-01', amount: '11900.00', taxAmount: '400.00' }]
    )
    const last = result[result.length - 1]
    expect(last.aporte).toBeCloseTo(7700, 1)
    expect(last.total).toBeCloseTo(10000, 1)
  })

  it('returns months in chronological order regardless of input order', () => {
    const result = buildPatrimonyTimeline(
      [
        { referenceMonth: '2025-03-01', amount: '100.00', yieldAmount: '0.00' },
        { referenceMonth: '2025-01-01', amount: '100.00', yieldAmount: '0.00' },
        { referenceMonth: '2025-02-01', amount: '100.00', yieldAmount: '0.00' },
      ],
      []
    )
    expect(result.map((r) => r.month)).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(result[2].aporte).toBe(300)
  })
})
