import { z } from 'zod'
import {
  uuidSchema,
  positiveAmountSchema,
  optionalPositiveAmountSchema,
  dateSchema,
  referenceMonthSchema,
} from './utils'

// ─── Client schemas (string FormData) ────────────────────────────────────────

export const transactionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  amount: positiveAmountSchema,
  date: dateSchema,
  categoryId: uuidSchema,
  accountId: uuidSchema,
})

const fixedExpenseBase = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  amount: positiveAmountSchema,
  dueDay: z
    .string()
    .min(1, 'Dia é obrigatório')
    .refine((v) => Number(v) >= 1 && Number(v) <= 31, 'Deve ser entre 1 e 31'),
  categoryId: uuidSchema,
  accountId: uuidSchema,
})

export const fixedExpenseEditSchema = fixedExpenseBase

export const fixedExpenseSchema = fixedExpenseBase.extend({
  referenceMonth: referenceMonthSchema,
})

export const installmentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  totalAmount: positiveAmountSchema,
  totalInstallments: z
    .string()
    .min(1, 'Informe o número de parcelas')
    .refine((v) => Number(v) >= 2 && Number(v) <= 60, 'Entre 2 e 60 parcelas'),
  startDate: dateSchema,
  categoryId: uuidSchema,
  accountId: uuidSchema,
})

const incomeBase = z.object({
  source: z.string().min(1, 'Origem é obrigatória').max(200),
  amount: positiveAmountSchema,
})

export const incomeEditSchema = incomeBase

export const incomeSchema = incomeBase.extend({
  referenceMonth: referenceMonthSchema,
})

export const installmentGroupSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  categoryId: uuidSchema,
  accountId: uuidSchema,
  newTotalAmount: optionalPositiveAmountSchema,
})

// ─── Action schemas (match action input types where fields differ from form) ──

export const createFixedExpenseActionSchema = z.object({
  name: z.string().min(1).max(200),
  amount: positiveAmountSchema,
  dueDay: z.number().int().min(1).max(31),
  categoryId: uuidSchema,
  accountId: uuidSchema,
  referenceMonth: referenceMonthSchema,
})

export const updateFixedExpenseActionSchema = createFixedExpenseActionSchema
  .omit({ referenceMonth: true })
  .extend({ id: uuidSchema })

export const createInstallmentActionSchema = z.object({
  name: z.string().min(1).max(200),
  totalAmount: positiveAmountSchema,
  totalInstallments: z.number().int().min(2).max(60),
  startDate: dateSchema,
  categoryId: uuidSchema,
  accountId: uuidSchema,
})

export const updateInstallmentGroupActionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  categoryId: uuidSchema,
  accountId: uuidSchema,
  newTotalAmount: optionalPositiveAmountSchema,
})

export const updateTransactionActionSchema = transactionSchema.extend({ id: uuidSchema })

export const updateIncomeActionSchema = incomeEditSchema.extend({ id: uuidSchema })
