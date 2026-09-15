import { z } from 'zod'
import { uuidSchema, dateSchema } from './utils'

// Datas em YYYY-MM-DD comparam corretamente como string. Igual é aceito: evento de um dia só.
const endNotBeforeStart = (d: { startDate?: string | null; endDate?: string | null }) =>
  !d.startDate || !d.endDate || d.endDate >= d.startDate

const endBeforeStartIssue = {
  message: 'A data final não pode ser anterior à inicial',
  path: ['endDate'],
}

export const tripSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório').max(200),
    startDate: dateSchema.optional().nullable(),
    endDate: dateSchema.optional().nullable(),
    goalId: uuidSchema.optional().nullable(),
  })
  .refine(endNotBeforeStart, endBeforeStartIssue)

// ─── Action schemas ───────────────────────────────────────────────────────────

export const upsertTripActionSchema = z
  .object({
    name: z.string().min(1).max(200),
    startDate: dateSchema.optional().nullable(),
    endDate: dateSchema.optional().nullable(),
    goalId: uuidSchema.optional().nullable(),
    existingId: uuidSchema.optional(),
  })
  .refine(endNotBeforeStart, endBeforeStartIssue)
