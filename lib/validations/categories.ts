import { z } from 'zod'

export const groupSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  groupId: z.string().min(1, 'Selecione um grupo'),
  defaultBudget: z.string().optional(),
  color: z.string().optional(),
})

export const accountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['credit', 'debit', 'pix']),
  closingDay: z
    .string()
    .refine((v) => !v || (Number(v) >= 1 && Number(v) <= 31), 'Deve ser entre 1 e 31'),
})

export const budgetOverrideSchema = z.object({
  amount: z.string().min(1, 'Informe um valor'),
})
