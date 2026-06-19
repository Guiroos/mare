import { describe, it, expect, vi, afterEach } from 'vitest'
import { format } from 'date-fns'
import {
  yearMonthToReferenceMonth,
  referenceMonthToYearMonth,
  prevMonth,
  nextMonth,
  parseDate,
  billingCycleDateRange,
  dateToReferenceMonth,
  formatMonthName,
  formatMonthYear,
  formatMonthShort,
  formatMonthAbbr,
  formatDisplayDate,
  formatDate,
  daysAgo,
  currentYearMonth,
  currentReferenceMonth,
  currentYear,
  todayParts,
  todayISOString,
  pastNMonths,
  futureNMonths,
  calcBaseReferenceMonth,
  calcInstallmentDate,
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

describe('dateToReferenceMonth', () => {
  it('converts any day of month to YYYY-MM-01', () => {
    expect(dateToReferenceMonth('2025-03-15')).toBe('2025-03-01')
    expect(dateToReferenceMonth('2025-03-31')).toBe('2025-03-01')
    expect(dateToReferenceMonth('2025-03-01')).toBe('2025-03-01')
  })

  it('handles leap year February', () => {
    expect(dateToReferenceMonth('2024-02-29')).toBe('2024-02-01')
  })

  it('handles year boundaries', () => {
    expect(dateToReferenceMonth('2025-12-31')).toBe('2025-12-01')
    expect(dateToReferenceMonth('2025-01-01')).toBe('2025-01-01')
  })
})

describe('formatMonthName', () => {
  it('formats YYYY-MM as full month name in pt-BR (lowercase)', () => {
    const result = formatMonthName('2025-03')
    expect(result).toContain('março')
    expect(result).toContain('2025')
  })

  it('uses de separator between month and year', () => {
    expect(formatMonthName('2025-01')).toMatch(/janeiro de 2025/)
  })

  it('handles December', () => {
    expect(formatMonthName('2024-12')).toContain('dezembro')
    expect(formatMonthName('2024-12')).toContain('2024')
  })
})

describe('formatMonthYear', () => {
  it('capitalizes the first letter of the month name', () => {
    const result = formatMonthYear('2025-03')
    expect(result.charAt(0)).toBe(result.charAt(0).toUpperCase())
  })

  it('contains the year', () => {
    expect(formatMonthYear('2025-03')).toContain('2025')
    expect(formatMonthYear('2024-12')).toContain('2024')
  })

  it('starts with capitalized month (Janeiro, Março, etc.)', () => {
    expect(formatMonthYear('2025-01')).toMatch(/^Janeiro/)
    expect(formatMonthYear('2025-03')).toMatch(/^Março/)
  })
})

describe('formatMonthShort', () => {
  it('contains 2-digit year', () => {
    expect(formatMonthShort('2025-03')).toContain('25')
    expect(formatMonthShort('2024-12')).toContain('24')
  })

  it('contains abbreviated month name in pt-BR', () => {
    expect(formatMonthShort('2025-03').toLowerCase()).toContain('mar')
    expect(formatMonthShort('2025-01').toLowerCase()).toContain('jan')
  })
})

describe('formatMonthAbbr', () => {
  it('returns abbreviated month name in pt-BR', () => {
    expect(formatMonthAbbr('2025-03').toLowerCase()).toContain('mar')
    expect(formatMonthAbbr('2025-01').toLowerCase()).toContain('jan')
    expect(formatMonthAbbr('2025-12').toLowerCase()).toContain('dez')
  })
})

describe('formatDisplayDate', () => {
  it('contains the day number', () => {
    expect(formatDisplayDate('2025-03-15')).toContain('15')
    expect(formatDisplayDate('2025-03-01')).toContain('1')
  })

  it('contains abbreviated month in pt-BR', () => {
    expect(formatDisplayDate('2025-03-15').toLowerCase()).toContain('mar')
    expect(formatDisplayDate('2025-01-10').toLowerCase()).toContain('jan')
  })
})

describe('formatDate', () => {
  it('formats YYYY-MM-DD as dd/MM/yyyy', () => {
    expect(formatDate('2025-03-15')).toBe('15/03/2025')
    expect(formatDate('2025-01-01')).toBe('01/01/2025')
    expect(formatDate('2024-12-31')).toBe('31/12/2024')
  })
})

describe('daysAgo', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for today', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(daysAgo('2025-03-15')).toBe(0)
  })

  it('returns 1 for yesterday', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(daysAgo('2025-03-14')).toBe(1)
  })

  it('returns 30 for 30 days ago', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(daysAgo('2025-02-13')).toBe(30)
  })
})

describe('currentYearMonth', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns current date as YYYY-MM', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(currentYearMonth()).toBe('2025-03')
  })

  it('handles year boundary', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2024-12-31T12:00:00'))
    expect(currentYearMonth()).toBe('2024-12')
  })
})

describe('currentReferenceMonth', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns first day of current month as YYYY-MM-01', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(currentReferenceMonth()).toBe('2025-03-01')
  })

  it('is already the first day when called on the 1st', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-01T12:00:00'))
    expect(currentReferenceMonth()).toBe('2025-03-01')
  })
})

describe('currentYear', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns current year as number', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(currentYear()).toBe(2025)
  })
})

describe('todayParts', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns day, month, year as integers', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(todayParts()).toEqual({ day: 15, month: 3, year: 2025 })
  })

  it('month is 1-indexed (March = 3, not 2)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-01T12:00:00'))
    expect(todayParts().month).toBe(3)
  })

  it('January is 1', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-01-20T12:00:00'))
    expect(todayParts()).toEqual({ day: 20, month: 1, year: 2025 })
  })
})

describe('todayISOString', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns today as YYYY-MM-DD', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    expect(todayISOString()).toBe('2025-03-15')
  })

  it('pads single-digit day and month with zero', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-01-05T12:00:00'))
    expect(todayISOString()).toBe('2025-01-05')
  })
})

describe('pastNMonths', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns N months as YYYY-MM-01, oldest first, ending with current', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    const result = pastNMonths(3)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('2025-01-01')
    expect(result[1]).toBe('2025-02-01')
    expect(result[2]).toBe('2025-03-01')
  })

  it('wraps across year boundary', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-02-01T12:00:00'))
    const result = pastNMonths(3)
    expect(result[0]).toBe('2024-12-01')
    expect(result[1]).toBe('2025-01-01')
    expect(result[2]).toBe('2025-02-01')
  })

  it('returns array with single element for n=1', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    const result = pastNMonths(1)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('2025-03-01')
  })
})

describe('futureNMonths', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns N months as YYYY-MM-01 starting from current month', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-03-15T12:00:00'))
    const result = futureNMonths(3)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('2025-03-01')
    expect(result[1]).toBe('2025-04-01')
    expect(result[2]).toBe('2025-05-01')
  })

  it('wraps across year boundary', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-11-01T12:00:00'))
    const result = futureNMonths(3)
    expect(result[0]).toBe('2025-11-01')
    expect(result[1]).toBe('2025-12-01')
    expect(result[2]).toBe('2026-01-01')
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

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

describe('calcBaseReferenceMonth', () => {
  it('sem closingDay: retorna startOfMonth da data de compra', () => {
    expect(fmt(calcBaseReferenceMonth(parseDate('2025-01-18'), null))).toBe('2025-01-01')
  })

  it('compra antes do fechamento (5 <= 16): retorna mês da compra', () => {
    expect(fmt(calcBaseReferenceMonth(parseDate('2025-01-05'), 16))).toBe('2025-01-01')
  })

  it('compra no dia exato do fechamento (16 == 16): retorna mês da compra', () => {
    expect(fmt(calcBaseReferenceMonth(parseDate('2025-01-16'), 16))).toBe('2025-01-01')
  })

  it('compra depois do fechamento (18 > 16): retorna mês seguinte', () => {
    expect(fmt(calcBaseReferenceMonth(parseDate('2025-01-18'), 16))).toBe('2025-02-01')
  })

  it('closingDay = 1 — tratado como calendário: retorna mês da compra mesmo depois do dia 1', () => {
    expect(fmt(calcBaseReferenceMonth(parseDate('2025-01-18'), 1))).toBe('2025-01-01')
  })
})

describe('calcInstallmentDate', () => {
  it('sem closingDay: retorna dia 1 do referenceMonth', () => {
    expect(fmt(calcInstallmentDate(parseDate('2025-02-01'), null))).toBe('2025-02-01')
  })

  it('closingDay = 1 — tratado como calendário: retorna dia 1 do referenceMonth', () => {
    expect(fmt(calcInstallmentDate(parseDate('2025-02-01'), 1))).toBe('2025-02-01')
  })

  it('closingDay+1 existe no mês anterior: retorna esse dia', () => {
    // referenceMonth fevereiro, closingDay 16 → dia 17 de janeiro existe
    expect(fmt(calcInstallmentDate(parseDate('2025-02-01'), 16))).toBe('2025-01-17')
  })

  it('fallback fevereiro não-bissexto (closingDay = 28): dia 29 não existe em fev → dia 1 de março', () => {
    // referenceMonth março, closingDay 28 → dia 29 de fevereiro não existe em 2025
    expect(fmt(calcInstallmentDate(parseDate('2025-03-01'), 28))).toBe('2025-03-01')
  })

  it('fallback mês com 30 dias (closingDay = 30): dia 31 não existe em abril → dia 1 de maio', () => {
    // referenceMonth maio, closingDay 30 → dia 31 de abril não existe
    expect(fmt(calcInstallmentDate(parseDate('2025-05-01'), 30))).toBe('2025-05-01')
  })

  it('closingDay = 31: dia 32 nunca existe — retorna dia 1 do referenceMonth', () => {
    expect(fmt(calcInstallmentDate(parseDate('2025-03-01'), 31))).toBe('2025-03-01')
  })
})
