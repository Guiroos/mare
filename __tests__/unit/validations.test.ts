import { describe, it, expect } from 'vitest'
import {
  positiveAmountSchema,
  nonNegativeAmountSchema,
  nullishNonNegativeAmountSchema,
  optionalPositiveAmountSchema,
  dateSchema,
  yearMonthSchema,
  referenceMonthSchema,
} from '@/lib/validations/utils'

describe('positiveAmountSchema', () => {
  it('accepts positive values', () => {
    expect(positiveAmountSchema.safeParse('10').success).toBe(true)
    expect(positiveAmountSchema.safeParse('0.01').success).toBe(true)
    expect(positiveAmountSchema.safeParse('9999.99').success).toBe(true)
  })

  it('rejects zero', () => {
    expect(positiveAmountSchema.safeParse('0').success).toBe(false)
  })

  it('rejects negative values', () => {
    expect(positiveAmountSchema.safeParse('-1').success).toBe(false)
    expect(positiveAmountSchema.safeParse('-0.01').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(positiveAmountSchema.safeParse('').success).toBe(false)
  })

  it('rejects non-numeric strings', () => {
    expect(positiveAmountSchema.safeParse('abc').success).toBe(false)
  })
})

describe('nonNegativeAmountSchema', () => {
  it('accepts zero', () => {
    expect(nonNegativeAmountSchema.safeParse('0').success).toBe(true)
  })

  it('accepts positive values', () => {
    expect(nonNegativeAmountSchema.safeParse('10').success).toBe(true)
    expect(nonNegativeAmountSchema.safeParse('0.01').success).toBe(true)
  })

  it('rejects negative values', () => {
    expect(nonNegativeAmountSchema.safeParse('-1').success).toBe(false)
    expect(nonNegativeAmountSchema.safeParse('-0.01').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(nonNegativeAmountSchema.safeParse('').success).toBe(false)
  })
})

describe('nullishNonNegativeAmountSchema', () => {
  it('accepts undefined', () => {
    expect(nullishNonNegativeAmountSchema.safeParse(undefined).success).toBe(true)
  })

  it('accepts null', () => {
    expect(nullishNonNegativeAmountSchema.safeParse(null).success).toBe(true)
  })

  it('accepts zero', () => {
    expect(nullishNonNegativeAmountSchema.safeParse('0').success).toBe(true)
  })

  it('accepts positive values', () => {
    expect(nullishNonNegativeAmountSchema.safeParse('10').success).toBe(true)
  })

  it('rejects negative values', () => {
    expect(nullishNonNegativeAmountSchema.safeParse('-1').success).toBe(false)
  })
})

describe('optionalPositiveAmountSchema', () => {
  it('accepts undefined (field omitted)', () => {
    expect(optionalPositiveAmountSchema.safeParse(undefined).success).toBe(true)
  })

  it('accepts positive values when present', () => {
    expect(optionalPositiveAmountSchema.safeParse('10').success).toBe(true)
    expect(optionalPositiveAmountSchema.safeParse('0.01').success).toBe(true)
  })

  it('rejects zero when present', () => {
    expect(optionalPositiveAmountSchema.safeParse('0').success).toBe(false)
  })

  it('rejects negative values when present', () => {
    expect(optionalPositiveAmountSchema.safeParse('-1').success).toBe(false)
  })
})

describe('dateSchema', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(dateSchema.safeParse('2025-03-15').success).toBe(true)
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true) // leap year
    expect(dateSchema.safeParse('2025-01-01').success).toBe(true)
  })

  it('rejects dates with out-of-range components (month 13)', () => {
    // Date.parse with month > 12 returns NaN — caught by the refine check
    expect(dateSchema.safeParse('2025-13-01').success).toBe(false)
  })

  it('does not validate calendar overflow (Feb 29 in non-leap year passes)', () => {
    // Date.parse overflows to March 1 instead of returning NaN — schema allows it
    expect(dateSchema.safeParse('2025-02-29').success).toBe(true)
  })

  it('rejects wrong format', () => {
    expect(dateSchema.safeParse('15/03/2025').success).toBe(false)
    expect(dateSchema.safeParse('2025-3-5').success).toBe(false)
    expect(dateSchema.safeParse('').success).toBe(false)
  })
})

describe('yearMonthSchema', () => {
  it('accepts valid YYYY-MM format', () => {
    expect(yearMonthSchema.safeParse('2025-01').success).toBe(true)
    expect(yearMonthSchema.safeParse('2025-12').success).toBe(true)
    expect(yearMonthSchema.safeParse('2000-06').success).toBe(true)
  })

  it('rejects short year format', () => {
    expect(yearMonthSchema.safeParse('25-01').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(yearMonthSchema.safeParse('').success).toBe(false)
  })

  it('rejects YYYY-MM-DD format', () => {
    expect(yearMonthSchema.safeParse('2025-01-01').success).toBe(false)
  })

  it('rejects single-digit month without leading zero', () => {
    expect(yearMonthSchema.safeParse('2025-1').success).toBe(false)
  })
})

describe('referenceMonthSchema', () => {
  it('accepts YYYY-MM-01 format', () => {
    expect(referenceMonthSchema.safeParse('2025-01-01').success).toBe(true)
    expect(referenceMonthSchema.safeParse('2025-12-01').success).toBe(true)
  })

  it('rejects days other than 01', () => {
    expect(referenceMonthSchema.safeParse('2025-01-15').success).toBe(false)
    expect(referenceMonthSchema.safeParse('2025-01-02').success).toBe(false)
    expect(referenceMonthSchema.safeParse('2025-01-31').success).toBe(false)
  })

  it('rejects YYYY-MM format (missing day)', () => {
    expect(referenceMonthSchema.safeParse('2025-01').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(referenceMonthSchema.safeParse('').success).toBe(false)
  })
})
