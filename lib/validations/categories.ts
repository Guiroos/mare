import { z } from 'zod'
import { uuidSchema, nonNegativeAmountSchema, nullishNonNegativeAmountSchema } from './utils'

export const groupSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  groupId: uuidSchema,
  defaultBudget: nullishNonNegativeAmountSchema,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional()
    .or(z.literal('')),
})

export const accountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  type: z.enum(['credit', 'debit', 'pix']),
  closingDay: z
    .string()
    .refine((v) => !v || (Number(v) >= 1 && Number(v) <= 31), 'Deve ser entre 1 e 31'),
})

export const budgetOverrideSchema = z.object({
  amount: nonNegativeAmountSchema,
})

// ─── Action schemas ───────────────────────────────────────────────────────────

export const accountActionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['credit', 'debit', 'pix']),
  closingDay: z.number().int().min(1).max(31).optional(),
})
