import { z } from 'zod'
import {
  uuidSchema,
  optionalUuidSchema,
  positiveAmountSchema,
  nullishNonNegativeAmountSchema,
  dateSchema,
  yearMonthSchema,
  referenceMonthSchema,
} from './utils'

export const investmentTypeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional()
    .or(z.literal('')),
  maturityDate: dateSchema.optional().or(z.literal('')),
})

function hasPositiveInvestmentValue(value: string | null | undefined) {
  if (!value) return false
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) && amount > 0
}

// client forms send YYYY-MM from <input type="month">
export const investmentEntrySchema = z
  .object({
    investmentTypeId: uuidSchema,
    referenceMonth: yearMonthSchema,
    amount: nullishNonNegativeAmountSchema,
    yieldAmount: nullishNonNegativeAmountSchema,
    excludeFromCashFlow: z.boolean().optional().default(false),
  })
  .refine(
    (data) =>
      hasPositiveInvestmentValue(data.amount) || hasPositiveInvestmentValue(data.yieldAmount),
    {
      message: 'Informe ao menos um aporte ou rendimento maior que zero',
      path: ['amount'],
    }
  )

const withdrawalBase = z.object({
  investmentTypeId: uuidSchema,
  amount: positiveAmountSchema,
  date: dateSchema,
  taxAmount: nullishNonNegativeAmountSchema,
})

// Viagem mora na entrada que o resgate cria (incomes.tripId). Só o destino "caixa"
// vira dinheiro gastável: reinvestimento não sai da carteira e transferência não
// cria entrada nenhuma para marcar.
export const withdrawalEditSchema = withdrawalBase.extend({ tripId: optionalUuidSchema })

export const withdrawalSchema = withdrawalBase
  .extend({
    destination: z.enum(['income', 'reinvest', 'transfer']),
    tripId: optionalUuidSchema,
  })
  .refine((data) => !data.tripId || data.destination === 'income', {
    message: 'Só resgates para o caixa podem ser vinculados a uma viagem',
    path: ['tripId'],
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
  .refine(
    (data) =>
      hasPositiveInvestmentValue(data.amount) || hasPositiveInvestmentValue(data.yieldAmount),
    {
      message: 'Informe ao menos um aporte ou rendimento maior que zero',
      path: ['amount'],
    }
  )

export const updateWithdrawalActionSchema = withdrawalEditSchema.extend({ id: uuidSchema })
