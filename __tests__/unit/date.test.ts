import { describe, it, expect } from 'vitest'
import {
  yearMonthToReferenceMonth,
  referenceMonthToYearMonth,
  prevMonth,
  nextMonth,
  parseDate,
  billingCycleDateRange,
} from '@/lib/utils/date'

describe('yearMonthToReferenceMonth', () => {
  it('appends -01 to YYYY-MM', () => {
    expect(yearMonthToReferenceMonth('2025-03')).toBe('2025-03-01')
    expect(yearMonthToReferenceMonth('2024-12')).toBe('2024-12-01')
    expect(yearMonthToReferenceMonth('2025-01')).toBe('2025-01-01')
  })
})

describe('referenceMonthToYearMonth', () => {
  it('strips -01 from YYYY-MM-01', () => {
    expect(referenceMonthToYearMonth('2025-03-01')).toBe('2025-03')
    expect(referenceMonthToYearMonth('2024-12-01')).toBe('2024-12')
  })

  it('is the inverse of yearMonthToReferenceMonth', () => {
    const ym = '2025-06'
    expect(referenceMonthToYearMonth(yearMonthToReferenceMonth(ym))).toBe(ym)
  })
})

describe('prevMonth', () => {
  it('returns the previous month', () => {
    expect(prevMonth('2025-03')).toBe('2025-02')
    expect(prevMonth('2025-06')).toBe('2025-05')
  })

  it('wraps from January to December of the previous year', () => {
    expect(prevMonth('2025-01')).toBe('2024-12')
  })
})

describe('nextMonth', () => {
  it('returns the next month', () => {
    expect(nextMonth('2025-03')).toBe('2025-04')
    expect(nextMonth('2025-06')).toBe('2025-07')
  })

  it('wraps from December to January of the next year', () => {
    expect(nextMonth('2025-12')).toBe('2026-01')
  })
})

describe('parseDate', () => {
  it('parses YYYY-MM-DD without UTC offset shifting the day', () => {
    const d = parseDate('2025-03-15')
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(2) // 0-indexed
    expect(d.getDate()).toBe(15)
  })

  it('uses T12:00:00 suffix to avoid DST/timezone issues', () => {
    const d = parseDate('2025-01-01')
    expect(d.getHours()).toBe(12)
  })
})

describe('billingCycleDateRange', () => {
  it('returns null when closingDay <= 1', () => {
    expect(billingCycleDateRange('2025-03', 1)).toBeNull()
    expect(billingCycleDateRange('2025-03', 0)).toBeNull()
  })

  it('calculates cycle correctly for closingDay=8', () => {
    const result = billingCycleDateRange('2025-03', 8)
    expect(result).not.toBeNull()
    expect(result!.start).toBe('2025-02-08')
    expect(result!.end).toBe('2025-03-07')
  })

  it('calculates cycle correctly for closingDay=15', () => {
    const result = billingCycleDateRange('2025-03', 15)
    expect(result!.start).toBe('2025-02-15')
    expect(result!.end).toBe('2025-03-14')
  })

  it('clamps start to last day of February (non-leap) for closingDay=31', () => {
    const result = billingCycleDateRange('2025-03', 31)
    expect(result!.start).toBe('2025-02-28')
    expect(result!.end).toBe('2025-03-30')
  })

  it('clamps start to last day of February (leap year) for closingDay=31', () => {
    const result = billingCycleDateRange('2024-03', 31)
    expect(result!.start).toBe('2024-02-29')
    expect(result!.end).toBe('2024-03-30')
  })

  it('clamps start correctly for closingDay=28 in February', () => {
    const result = billingCycleDateRange('2025-03', 28)
    expect(result!.start).toBe('2025-02-28')
    expect(result!.end).toBe('2025-03-27')
  })

  it('returns a label string in expected format', () => {
    const result = billingCycleDateRange('2025-03', 8)
    expect(result!.label).toMatch(/\d{2}\/\w{3} → \d{2}\/\w{3}/)
  })
})
