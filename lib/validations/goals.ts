import { z } from 'zod'

export const goalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  targetAmount: z.string().min(1, 'Valor alvo é obrigatório'),
})

export const contributionSchema = z.object({
  amount: z.string().min(1, 'Valor é obrigatório'),
  referenceMonth: z.string().min(1, 'Mês é obrigatório'),
})
