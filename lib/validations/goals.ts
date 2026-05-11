import { z } from 'zod'
import { uuidSchema, positiveAmountSchema, referenceMonthSchema, dateSchema } from './utils'

export const goalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  targetAmount: positiveAmountSchema,
})

export const contributionSchema = z.object({
  amount: positiveAmountSchema,
  referenceMonth: referenceMonthSchema,
})

// ─── Action schemas ───────────────────────────────────────────────────────────

export const upsertGoalActionSchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: positiveAmountSchema,
  targetDate: dateSchema.optional().nullable(),
  investmentTypeId: uuidSchema.optional().nullable(),
  existingId: uuidSchema.optional(),
})

export const addContributionActionSchema = contributionSchema.extend({ goalId: uuidSchema })

export const updateContributionActionSchema = contributionSchema.extend({ id: uuidSchema })
