import { z } from 'zod'

export const investmentTypeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
})

export const investmentEntrySchema = z.object({
  investmentTypeId: z.string().min(1, 'Selecione o tipo de investimento'),
  referenceMonth: z.string().min(1, 'Mês é obrigatório'),
})

const withdrawalBase = z.object({
  investmentTypeId: z.string().min(1, 'Selecione o tipo de investimento'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
})

export const withdrawalEditSchema = withdrawalBase

export const withdrawalSchema = withdrawalBase.extend({
  destination: z.enum(['income', 'transfer']),
})
