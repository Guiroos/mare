import { z } from 'zod'
import {
  uuidSchema,
  positiveAmountSchema,
  yearMonthSchema,
  referenceMonthSchema,
  dateSchema,
} from './utils'

export const goalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  targetAmount: positiveAmountSchema,
})

// client forms send YYYY-MM from <input type="month">
export const contributionSchema = z.object({
  amount: positiveAmountSchema,
  referenceMonth: yearMonthSchema,
})

// ─── Action schemas ───────────────────────────────────────────────────────────

export const upsertGoalActionSchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: positiveAmountSchema,
  targetDate: dateSchema.optional().nullable(),
  investmentTypeId: uuidSchema.optional().nullable(),
  existingId: uuidSchema.optional(),
})

// action schemas receive referenceMonth as YYYY-MM-01 (converted by the form)
export const addContributionActionSchema = z.object({
  goalId: uuidSchema,
  amount: positiveAmountSchema,
  referenceMonth: referenceMonthSchema,
})

export const updateContributionActionSchema = z.object({
  id: uuidSchema,
  amount: positiveAmountSchema,
  referenceMonth: referenceMonthSchema,
})
