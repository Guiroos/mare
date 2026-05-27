import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  positiveAmountSchema,
  nonNegativeAmountSchema,
  nullishNonNegativeAmountSchema,
  optionalPositiveAmountSchema,
  dateSchema,
  yearMonthSchema,
  referenceMonthSchema,
  formatZodErrors,
  uuidSchema,
} from '@/lib/validations/utils'
import {
  transactionSchema,
  fixedExpenseSchema,
  installmentSchema,
  incomeSchema,
} from '@/lib/validations/transactions'

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

// ─── formatZodErrors ──────────────────────────────────────────────────────────

describe('formatZodErrors', () => {
  it('maps field errors to first message per field', () => {
    const schema = z.object({
      name: z.string().min(1, 'Nome obrigatório'),
      amount: z.number().positive('Valor inválido'),
    })
    const result = schema.safeParse({ name: '', amount: -1 })
    expect(result.success).toBe(false)
    const errors = formatZodErrors((result as { success: false; error: z.ZodError }).error)
    expect(errors.name).toBe('Nome obrigatório')
    expect(errors.amount).toBe('Valor inválido')
  })

  it('uses _root key for errors with empty path (top-level schema)', () => {
    const schema = z.string().min(1, 'Campo obrigatório')
    const result = schema.safeParse('')
    expect(result.success).toBe(false)
    const errors = formatZodErrors((result as { success: false; error: z.ZodError }).error)
    expect(errors['_root']).toBe('Campo obrigatório')
  })

  it('keeps only first error per field when multiple issues on same path', () => {
    const schema = z.object({
      val: z.string().superRefine((v, ctx) => {
        if (!v) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Erro 1' })
        if (!v) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Erro 2' })
      }),
    })
    const result = schema.safeParse({ val: '' })
    expect(result.success).toBe(false)
    const errors = formatZodErrors((result as { success: false; error: z.ZodError }).error)
    expect(errors.val).toBe('Erro 1')
  })

  it('returns empty object when there are no issues', () => {
    const zodError = new z.ZodError([])
    expect(formatZodErrors(zodError)).toEqual({})
  })

  it('handles multiple fields each with one error', () => {
    const schema = z.object({
      a: z.string().min(1, 'A obrigatório'),
      b: z.number().min(0, 'B inválido'),
    })
    const result = schema.safeParse({ a: '', b: -1 })
    expect(result.success).toBe(false)
    const errors = formatZodErrors((result as { success: false; error: z.ZodError }).error)
    expect(Object.keys(errors)).toHaveLength(2)
    expect(errors.a).toBe('A obrigatório')
    expect(errors.b).toBe('B inválido')
  })
})

// ─── uuidSchema ──────────────────────────────────────────────────────────────

describe('uuidSchema', () => {
  it('accepts valid UUIDs', () => {
    expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
    expect(uuidSchema.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true)
  })

  it('rejects invalid UUIDs', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
    expect(uuidSchema.safeParse('').success).toBe(false)
    expect(uuidSchema.safeParse('123').success).toBe(false)
  })
})

// ─── Transaction schemas ──────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('transactionSchema', () => {
  const base = {
    name: 'Mercado',
    amount: '150.00',
    date: '2025-03-15',
    categoryId: VALID_UUID,
    accountId: VALID_UUID,
  }

  it('accepts valid transaction data', () => {
    expect(transactionSchema.safeParse(base).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(transactionSchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })

  it('rejects name over 200 characters', () => {
    expect(transactionSchema.safeParse({ ...base, name: 'a'.repeat(201) }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(transactionSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects invalid date format', () => {
    expect(transactionSchema.safeParse({ ...base, date: '15/03/2025' }).success).toBe(false)
  })

  it('rejects invalid UUID for categoryId', () => {
    expect(transactionSchema.safeParse({ ...base, categoryId: 'not-uuid' }).success).toBe(false)
  })

  it('rejects invalid UUID for accountId', () => {
    expect(transactionSchema.safeParse({ ...base, accountId: 'not-uuid' }).success).toBe(false)
  })
})

describe('fixedExpenseSchema — dueDay validation', () => {
  const base = {
    name: 'Aluguel',
    amount: '1500.00',
    dueDay: '5',
    categoryId: VALID_UUID,
    accountId: VALID_UUID,
    referenceMonth: '2025-03',
  }

  it('accepts dueDay in range 1–31', () => {
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: '1' }).success).toBe(true)
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: '15' }).success).toBe(true)
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: '31' }).success).toBe(true)
  })

  it('rejects dueDay = 0', () => {
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: '0' }).success).toBe(false)
  })

  it('rejects dueDay = 32', () => {
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: '32' }).success).toBe(false)
  })

  it('rejects empty dueDay', () => {
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: '' }).success).toBe(false)
  })

  it('rejects non-numeric dueDay', () => {
    // Number('abc') is NaN; NaN >= 1 is false — rejects
    expect(fixedExpenseSchema.safeParse({ ...base, dueDay: 'abc' }).success).toBe(false)
  })

  it('rejects referenceMonth in wrong format', () => {
    expect(fixedExpenseSchema.safeParse({ ...base, referenceMonth: '2025-03-01' }).success).toBe(
      false
    )
    expect(fixedExpenseSchema.safeParse({ ...base, referenceMonth: '03-2025' }).success).toBe(false)
  })
})

describe('installmentSchema — totalInstallments validation', () => {
  const base = {
    name: 'Notebook',
    totalAmount: '3000.00',
    totalInstallments: '12',
    startDate: '2025-03-15',
    categoryId: VALID_UUID,
    accountId: VALID_UUID,
  }

  it('accepts totalInstallments in range 2–60', () => {
    expect(installmentSchema.safeParse({ ...base, totalInstallments: '2' }).success).toBe(true)
    expect(installmentSchema.safeParse({ ...base, totalInstallments: '30' }).success).toBe(true)
    expect(installmentSchema.safeParse({ ...base, totalInstallments: '60' }).success).toBe(true)
  })

  it('rejects totalInstallments = 1', () => {
    expect(installmentSchema.safeParse({ ...base, totalInstallments: '1' }).success).toBe(false)
  })

  it('rejects totalInstallments = 61', () => {
    expect(installmentSchema.safeParse({ ...base, totalInstallments: '61' }).success).toBe(false)
  })

  it('rejects empty totalInstallments', () => {
    expect(installmentSchema.safeParse({ ...base, totalInstallments: '' }).success).toBe(false)
  })

  it('rejects non-numeric totalInstallments', () => {
    expect(installmentSchema.safeParse({ ...base, totalInstallments: 'doze' }).success).toBe(false)
  })

  it('rejects invalid startDate format', () => {
    expect(installmentSchema.safeParse({ ...base, startDate: '15/03/2025' }).success).toBe(false)
  })

  it('rejects zero totalAmount', () => {
    expect(installmentSchema.safeParse({ ...base, totalAmount: '0' }).success).toBe(false)
  })
})

describe('incomeSchema', () => {
  const base = {
    source: 'Salário',
    amount: '5000.00',
    referenceMonth: '2025-03',
  }

  it('accepts valid income data', () => {
    expect(incomeSchema.safeParse(base).success).toBe(true)
  })

  it('rejects empty source', () => {
    expect(incomeSchema.safeParse({ ...base, source: '' }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(incomeSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects referenceMonth in wrong format', () => {
    expect(incomeSchema.safeParse({ ...base, referenceMonth: '2025-03-01' }).success).toBe(false)
  })
})
