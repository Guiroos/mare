import { z } from 'zod'
import { uuidSchema, dateSchema } from './utils'

export const tripSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  startDate: dateSchema.optional().nullable(),
  endDate: dateSchema.optional().nullable(),
  goalId: uuidSchema.optional().nullable(),
})

// ─── Action schemas ───────────────────────────────────────────────────────────

export const upsertTripActionSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: dateSchema.optional().nullable(),
  endDate: dateSchema.optional().nullable(),
  goalId: uuidSchema.optional().nullable(),
  existingId: uuidSchema.optional(),
})
