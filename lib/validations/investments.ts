import { z } from 'zod'
import {
  uuidSchema,
  positiveAmountSchema,
  nullishNonNegativeAmountSchema,
  dateSchema,
  yearMonthSchema,
  referenceMonthSchema,
} from './utils'

export const investmentTypeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
})

// client forms send YYYY-MM from <input type="month">
export const investmentEntrySchema = z
  .object({
    investmentTypeId: uuidSchema,
    referenceMonth: yearMonthSchema,
    amount: nullishNonNegativeAmountSchema,
    yieldAmount: nullishNonNegativeAmountSchema,
    excludeFromCashFlow: z.boolean().optional().default(false),
  })
  .refine((data) => !!data.amount || !!data.yieldAmount, {
    message: 'Informe ao menos o aporte ou o rendimento',
    path: ['amount'],
  })

const withdrawalBase = z.object({
  investmentTypeId: uuidSchema,
  amount: positiveAmountSchema,
  date: dateSchema,
})

export const withdrawalEditSchema = withdrawalBase

export const withdrawalSchema = withdrawalBase.extend({
  destination: z.enum(['income', 'transfer']),
})

// ─── Action schemas ───────────────────────────────────────────────────────────

// upsertInvestment receives referenceMonth as YYYY-MM-01 (converted by the form)
export const upsertInvestmentActionSchema = z
  .object({
    investmentTypeId: uuidSchema,
    referenceMonth: referenceMonthSchema,
    amount: nullishNonNegativeAmountSchema,
    yieldAmount: nullishNonNegativeAmountSchema,
    excludeFromCashFlow: z.boolean().optional().default(false),
  })
  .refine((data) => !!data.amount || !!data.yieldAmount, {
    message: 'Informe ao menos o aporte ou o rendimento',
    path: ['amount'],
  })

export const updateWithdrawalActionSchema = withdrawalBase.extend({ id: uuidSchema })
