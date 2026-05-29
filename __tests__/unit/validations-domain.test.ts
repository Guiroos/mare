import { describe, it, expect } from 'vitest'

import {
  groupSchema,
  categorySchema,
  accountSchema,
  budgetOverrideSchema,
  accountActionSchema,
} from '@/lib/validations/categories'
import {
  personSchema,
  debtChargeSchema,
  debtPaymentSchema,
  settleChargeSchema,
} from '@/lib/validations/debtors'
import { faturaPaymentActionSchema } from '@/lib/validations/fatura'
import {
  goalSchema,
  contributionSchema,
  upsertGoalActionSchema,
  addContributionActionSchema,
  updateContributionActionSchema,
} from '@/lib/validations/goals'
import {
  investmentTypeSchema,
  investmentEntrySchema,
  withdrawalSchema,
  upsertInvestmentActionSchema,
} from '@/lib/validations/investments'
import { creditModeSchema } from '@/lib/validations/settings'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ─── categories.ts ────────────────────────────────────────────────────────────

describe('groupSchema', () => {
  it('accepts valid name', () => {
    expect(groupSchema.safeParse({ name: 'Moradia' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(groupSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('rejects name over 100 characters', () => {
    expect(groupSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false)
  })
})

describe('categorySchema', () => {
  const base = {
    name: 'Aluguel',
    groupId: VALID_UUID,
    defaultBudget: '1500',
    color: '#1a78c4',
  }

  it('accepts valid category data', () => {
    expect(categorySchema.safeParse(base).success).toBe(true)
  })

  it('accepts empty string for color (no color selected)', () => {
    expect(categorySchema.safeParse({ ...base, color: '' }).success).toBe(true)
  })

  it('accepts undefined color (optional)', () => {
    const { name, groupId, defaultBudget } = base
    expect(categorySchema.safeParse({ name, groupId, defaultBudget }).success).toBe(true)
  })

  it('accepts null/undefined defaultBudget', () => {
    expect(categorySchema.safeParse({ ...base, defaultBudget: undefined }).success).toBe(true)
    expect(categorySchema.safeParse({ ...base, defaultBudget: null }).success).toBe(true)
  })

  it('accepts zero defaultBudget', () => {
    expect(categorySchema.safeParse({ ...base, defaultBudget: '0' }).success).toBe(true)
  })

  it('rejects invalid hex color', () => {
    expect(categorySchema.safeParse({ ...base, color: 'red' }).success).toBe(false)
    expect(categorySchema.safeParse({ ...base, color: '#xyz' }).success).toBe(false)
    expect(categorySchema.safeParse({ ...base, color: '#1a78c' }).success).toBe(false) // 5 chars
  })

  it('rejects invalid groupId', () => {
    expect(categorySchema.safeParse({ ...base, groupId: 'not-uuid' }).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(categorySchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })
})

describe('accountSchema', () => {
  const base = { name: 'Nubank', type: 'credit' as const, closingDay: '10' }

  it('accepts valid credit account with closingDay', () => {
    expect(accountSchema.safeParse(base).success).toBe(true)
  })

  it('accepts debit and pix types', () => {
    expect(accountSchema.safeParse({ ...base, type: 'debit' }).success).toBe(true)
    expect(accountSchema.safeParse({ ...base, type: 'pix' }).success).toBe(true)
  })

  it('accepts empty closingDay (not required for debit/pix)', () => {
    expect(accountSchema.safeParse({ ...base, closingDay: '' }).success).toBe(true)
  })

  it('accepts closingDay at boundaries 1 and 31', () => {
    expect(accountSchema.safeParse({ ...base, closingDay: '1' }).success).toBe(true)
    expect(accountSchema.safeParse({ ...base, closingDay: '31' }).success).toBe(true)
  })

  it('rejects closingDay = 0', () => {
    expect(accountSchema.safeParse({ ...base, closingDay: '0' }).success).toBe(false)
  })

  it('rejects closingDay = 32', () => {
    expect(accountSchema.safeParse({ ...base, closingDay: '32' }).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(accountSchema.safeParse({ ...base, type: 'savings' }).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(accountSchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })
})

describe('budgetOverrideSchema', () => {
  it('accepts zero (overrides to no budget)', () => {
    expect(budgetOverrideSchema.safeParse({ amount: '0' }).success).toBe(true)
  })

  it('accepts positive amount', () => {
    expect(budgetOverrideSchema.safeParse({ amount: '500' }).success).toBe(true)
  })

  it('rejects negative amount', () => {
    expect(budgetOverrideSchema.safeParse({ amount: '-1' }).success).toBe(false)
  })

  it('rejects empty amount', () => {
    expect(budgetOverrideSchema.safeParse({ amount: '' }).success).toBe(false)
  })
})

describe('accountActionSchema', () => {
  it('accepts valid data without closingDay', () => {
    expect(accountActionSchema.safeParse({ name: 'Conta', type: 'debit' }).success).toBe(true)
  })

  it('accepts closingDay as number in range 1-31', () => {
    expect(
      accountActionSchema.safeParse({ name: 'Nubank', type: 'credit', closingDay: 10 }).success
    ).toBe(true)
  })

  it('rejects closingDay = 0', () => {
    expect(
      accountActionSchema.safeParse({ name: 'Nubank', type: 'credit', closingDay: 0 }).success
    ).toBe(false)
  })

  it('rejects closingDay = 32', () => {
    expect(
      accountActionSchema.safeParse({ name: 'Nubank', type: 'credit', closingDay: 32 }).success
    ).toBe(false)
  })
})

// ─── debtors.ts ───────────────────────────────────────────────────────────────

describe('personSchema', () => {
  const base = { name: 'João Silva', email: '', phone: '', notes: '' }

  it('accepts valid person with empty optional fields', () => {
    expect(personSchema.safeParse(base).success).toBe(true)
  })

  it('accepts valid email when provided', () => {
    expect(personSchema.safeParse({ ...base, email: 'joao@example.com' }).success).toBe(true)
  })

  it('accepts empty string for email (no email)', () => {
    expect(personSchema.safeParse({ ...base, email: '' }).success).toBe(true)
  })

  it('rejects invalid email format', () => {
    expect(personSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(personSchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })

  it('rejects name over 200 characters', () => {
    expect(personSchema.safeParse({ ...base, name: 'a'.repeat(201) }).success).toBe(false)
  })
})

describe('debtChargeSchema', () => {
  const base = {
    personId: VALID_UUID,
    amount: '150.00',
    description: 'Empréstimo',
    entryDate: '2025-03-15',
    notes: '',
  }

  it('accepts valid charge data', () => {
    expect(debtChargeSchema.safeParse(base).success).toBe(true)
  })

  it('rejects zero amount', () => {
    expect(debtChargeSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects empty description', () => {
    expect(debtChargeSchema.safeParse({ ...base, description: '' }).success).toBe(false)
  })

  it('rejects invalid date', () => {
    expect(debtChargeSchema.safeParse({ ...base, entryDate: '15/03/2025' }).success).toBe(false)
  })

  it('rejects invalid personId', () => {
    expect(debtChargeSchema.safeParse({ ...base, personId: 'not-uuid' }).success).toBe(false)
  })
})

describe('debtPaymentSchema', () => {
  const base = {
    personId: VALID_UUID,
    amount: '150.00',
    description: 'Pagamento',
    entryDate: '2025-03-15',
    createIncome: false,
  }

  it('accepts payment without referenceMonth when createIncome=false', () => {
    expect(debtPaymentSchema.safeParse(base).success).toBe(true)
  })

  it('accepts payment with referenceMonth when createIncome=true', () => {
    expect(
      debtPaymentSchema.safeParse({
        ...base,
        createIncome: true,
        referenceMonth: '2025-03-01',
      }).success
    ).toBe(true)
  })

  it('rejects createIncome=true without referenceMonth', () => {
    const result = debtPaymentSchema.safeParse({ ...base, createIncome: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      expect(fieldErrors.referenceMonth).toBeDefined()
    }
  })

  it('rejects zero amount', () => {
    expect(debtPaymentSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects invalid referenceMonth format (YYYY-MM instead of YYYY-MM-01)', () => {
    expect(
      debtPaymentSchema.safeParse({
        ...base,
        createIncome: true,
        referenceMonth: '2025-03',
      }).success
    ).toBe(false)
  })
})

describe('settleChargeSchema', () => {
  const base = {
    chargeId: VALID_UUID,
    personId: VALID_UUID,
    entryDate: '2025-03-15',
    createIncome: false,
  }

  it('accepts settlement without referenceMonth when createIncome=false', () => {
    expect(settleChargeSchema.safeParse(base).success).toBe(true)
  })

  it('accepts settlement with referenceMonth when createIncome=true', () => {
    expect(
      settleChargeSchema.safeParse({
        ...base,
        createIncome: true,
        referenceMonth: '2025-03-01',
      }).success
    ).toBe(true)
  })

  it('rejects createIncome=true without referenceMonth', () => {
    const result = settleChargeSchema.safeParse({ ...base, createIncome: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      expect(fieldErrors.referenceMonth).toBeDefined()
    }
  })

  it('rejects invalid chargeId', () => {
    expect(settleChargeSchema.safeParse({ ...base, chargeId: 'not-uuid' }).success).toBe(false)
  })
})

// ─── fatura.ts ────────────────────────────────────────────────────────────────

describe('faturaPaymentActionSchema', () => {
  const base = {
    faturaAccountId: VALID_UUID,
    faturaCycleMonth: '2025-03-01',
    sourceAccountId: VALID_UUID,
    amount: '1500.00',
    date: '2025-03-15',
  }

  it('accepts valid fatura payment data', () => {
    expect(faturaPaymentActionSchema.safeParse(base).success).toBe(true)
  })

  it('rejects zero amount', () => {
    expect(faturaPaymentActionSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects invalid faturaCycleMonth (must be YYYY-MM-01)', () => {
    expect(
      faturaPaymentActionSchema.safeParse({ ...base, faturaCycleMonth: '2025-03' }).success
    ).toBe(false)
    expect(
      faturaPaymentActionSchema.safeParse({ ...base, faturaCycleMonth: '2025-03-15' }).success
    ).toBe(false)
  })

  it('rejects invalid UUIDs', () => {
    expect(
      faturaPaymentActionSchema.safeParse({ ...base, faturaAccountId: 'not-uuid' }).success
    ).toBe(false)
    expect(
      faturaPaymentActionSchema.safeParse({ ...base, sourceAccountId: 'not-uuid' }).success
    ).toBe(false)
  })

  it('rejects invalid date format', () => {
    expect(faturaPaymentActionSchema.safeParse({ ...base, date: '15/03/2025' }).success).toBe(false)
  })
})

// ─── goals.ts ────────────────────────────────────────────────────────────────

describe('goalSchema', () => {
  it('accepts valid goal', () => {
    expect(goalSchema.safeParse({ name: 'Viagem', targetAmount: '10000' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(goalSchema.safeParse({ name: '', targetAmount: '10000' }).success).toBe(false)
  })

  it('rejects zero targetAmount', () => {
    expect(goalSchema.safeParse({ name: 'Viagem', targetAmount: '0' }).success).toBe(false)
  })
})

describe('contributionSchema', () => {
  it('accepts valid contribution', () => {
    expect(contributionSchema.safeParse({ amount: '500', referenceMonth: '2025-03' }).success).toBe(
      true
    )
  })

  it('rejects zero amount', () => {
    expect(contributionSchema.safeParse({ amount: '0', referenceMonth: '2025-03' }).success).toBe(
      false
    )
  })

  it('rejects referenceMonth in YYYY-MM-DD format', () => {
    expect(
      contributionSchema.safeParse({ amount: '500', referenceMonth: '2025-03-01' }).success
    ).toBe(false)
  })
})

describe('upsertGoalActionSchema', () => {
  const base = { name: 'Viagem', targetAmount: '10000' }

  it('accepts minimal valid data', () => {
    expect(upsertGoalActionSchema.safeParse(base).success).toBe(true)
  })

  it('accepts null targetDate and investmentTypeId', () => {
    expect(
      upsertGoalActionSchema.safeParse({
        ...base,
        targetDate: null,
        investmentTypeId: null,
      }).success
    ).toBe(true)
  })

  it('accepts valid targetDate', () => {
    expect(upsertGoalActionSchema.safeParse({ ...base, targetDate: '2026-12-31' }).success).toBe(
      true
    )
  })

  it('accepts existingId for updates', () => {
    expect(upsertGoalActionSchema.safeParse({ ...base, existingId: VALID_UUID }).success).toBe(true)
  })

  it('rejects invalid existingId', () => {
    expect(upsertGoalActionSchema.safeParse({ ...base, existingId: 'not-uuid' }).success).toBe(
      false
    )
  })
})

describe('addContributionActionSchema', () => {
  const base = { goalId: VALID_UUID, amount: '500', referenceMonth: '2025-03-01' }

  it('accepts valid data', () => {
    expect(addContributionActionSchema.safeParse(base).success).toBe(true)
  })

  it('rejects referenceMonth in YYYY-MM format', () => {
    expect(
      addContributionActionSchema.safeParse({ ...base, referenceMonth: '2025-03' }).success
    ).toBe(false)
  })

  it('rejects invalid goalId', () => {
    expect(addContributionActionSchema.safeParse({ ...base, goalId: 'not-uuid' }).success).toBe(
      false
    )
  })
})

describe('updateContributionActionSchema', () => {
  it('accepts valid data with id', () => {
    expect(
      updateContributionActionSchema.safeParse({
        id: VALID_UUID,
        amount: '500',
        referenceMonth: '2025-03-01',
      }).success
    ).toBe(true)
  })

  it('rejects invalid id', () => {
    expect(
      updateContributionActionSchema.safeParse({
        id: 'not-uuid',
        amount: '500',
        referenceMonth: '2025-03-01',
      }).success
    ).toBe(false)
  })
})

// ─── investments.ts ───────────────────────────────────────────────────────────

describe('investmentTypeSchema', () => {
  it('accepts valid type with color', () => {
    expect(investmentTypeSchema.safeParse({ name: 'Renda Fixa', color: '#1a78c4' }).success).toBe(
      true
    )
  })

  it('accepts empty string color', () => {
    expect(investmentTypeSchema.safeParse({ name: 'Renda Fixa', color: '' }).success).toBe(true)
  })

  it('accepts undefined color', () => {
    expect(investmentTypeSchema.safeParse({ name: 'Renda Fixa' }).success).toBe(true)
  })

  it('rejects invalid hex color', () => {
    expect(investmentTypeSchema.safeParse({ name: 'Renda Fixa', color: 'blue' }).success).toBe(
      false
    )
  })

  it('rejects empty name', () => {
    expect(investmentTypeSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('accepts valid maturityDate', () => {
    expect(
      investmentTypeSchema.safeParse({ name: 'CDB', maturityDate: '2026-12-31' }).success
    ).toBe(true)
  })

  it('accepts empty string maturityDate (reset via input)', () => {
    expect(investmentTypeSchema.safeParse({ name: 'CDB', maturityDate: '' }).success).toBe(true)
  })

  it('accepts undefined maturityDate', () => {
    expect(investmentTypeSchema.safeParse({ name: 'CDB' }).success).toBe(true)
  })

  it('rejects invalid maturityDate format', () => {
    expect(
      investmentTypeSchema.safeParse({ name: 'CDB', maturityDate: '31/12/2026' }).success
    ).toBe(false)
  })
})

describe('investmentEntrySchema — at-least-one refine', () => {
  const base = {
    investmentTypeId: VALID_UUID,
    referenceMonth: '2025-03',
    amount: null,
    yieldAmount: null,
  }

  it('accepts when only amount > 0', () => {
    expect(investmentEntrySchema.safeParse({ ...base, amount: '1000' }).success).toBe(true)
  })

  it('accepts when only yieldAmount > 0', () => {
    expect(investmentEntrySchema.safeParse({ ...base, yieldAmount: '50' }).success).toBe(true)
  })

  it('accepts when both amount and yieldAmount > 0', () => {
    expect(
      investmentEntrySchema.safeParse({ ...base, amount: '1000', yieldAmount: '50' }).success
    ).toBe(true)
  })

  it('rejects when both are null', () => {
    expect(investmentEntrySchema.safeParse(base).success).toBe(false)
  })

  it('rejects when both are zero', () => {
    expect(
      investmentEntrySchema.safeParse({ ...base, amount: '0', yieldAmount: '0' }).success
    ).toBe(false)
  })

  it('rejects when amount is zero and yieldAmount is null', () => {
    expect(investmentEntrySchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects invalid referenceMonth format (YYYY-MM-DD)', () => {
    expect(
      investmentEntrySchema.safeParse({ ...base, amount: '100', referenceMonth: '2025-03-01' })
        .success
    ).toBe(false)
  })
})

describe('withdrawalSchema', () => {
  const base = {
    investmentTypeId: VALID_UUID,
    amount: '500',
    date: '2025-03-15',
    destination: 'income' as const,
  }

  it('accepts destination=income', () => {
    expect(withdrawalSchema.safeParse(base).success).toBe(true)
  })

  it('accepts destination=transfer', () => {
    expect(withdrawalSchema.safeParse({ ...base, destination: 'transfer' }).success).toBe(true)
  })

  it('rejects invalid destination', () => {
    expect(withdrawalSchema.safeParse({ ...base, destination: 'cash' }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(withdrawalSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
  })

  it('rejects invalid date format', () => {
    expect(withdrawalSchema.safeParse({ ...base, date: '15/03/2025' }).success).toBe(false)
  })

  it('accepts taxAmount null', () => {
    expect(withdrawalSchema.safeParse({ ...base, taxAmount: null }).success).toBe(true)
  })

  it('accepts taxAmount zero', () => {
    expect(withdrawalSchema.safeParse({ ...base, taxAmount: '0' }).success).toBe(true)
  })

  it('accepts taxAmount positive value', () => {
    expect(withdrawalSchema.safeParse({ ...base, taxAmount: '200' }).success).toBe(true)
  })

  it('rejects negative taxAmount', () => {
    expect(withdrawalSchema.safeParse({ ...base, taxAmount: '-1' }).success).toBe(false)
  })
})

describe('upsertInvestmentActionSchema — at-least-one refine', () => {
  const base = {
    investmentTypeId: VALID_UUID,
    referenceMonth: '2025-03-01',
    amount: null,
    yieldAmount: null,
  }

  it('accepts when only amount > 0', () => {
    expect(upsertInvestmentActionSchema.safeParse({ ...base, amount: '1000' }).success).toBe(true)
  })

  it('accepts when only yieldAmount > 0', () => {
    expect(upsertInvestmentActionSchema.safeParse({ ...base, yieldAmount: '50' }).success).toBe(
      true
    )
  })

  it('rejects when both are null', () => {
    expect(upsertInvestmentActionSchema.safeParse(base).success).toBe(false)
  })

  it('rejects referenceMonth in YYYY-MM format (action expects YYYY-MM-01)', () => {
    expect(
      upsertInvestmentActionSchema.safeParse({
        ...base,
        amount: '100',
        referenceMonth: '2025-03',
      }).success
    ).toBe(false)
  })
})

// ─── settings.ts ─────────────────────────────────────────────────────────────

describe('creditModeSchema', () => {
  it('accepts accrual mode without faturaActiveFrom', () => {
    expect(creditModeSchema.safeParse({ creditMode: 'accrual' }).success).toBe(true)
  })

  it('accepts fatura mode with faturaActiveFrom', () => {
    expect(
      creditModeSchema.safeParse({
        creditMode: 'fatura',
        faturaActiveFrom: '2025-01',
      }).success
    ).toBe(true)
  })

  it('rejects fatura mode without faturaActiveFrom', () => {
    const result = creditModeSchema.safeParse({ creditMode: 'fatura' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      expect(fieldErrors.faturaActiveFrom).toBeDefined()
    }
  })

  it('rejects invalid creditMode value', () => {
    expect(creditModeSchema.safeParse({ creditMode: 'cash' }).success).toBe(false)
  })

  it('rejects invalid faturaActiveFrom format', () => {
    expect(
      creditModeSchema.safeParse({
        creditMode: 'fatura',
        faturaActiveFrom: '2025-01-01',
      }).success
    ).toBe(false)
  })
})
