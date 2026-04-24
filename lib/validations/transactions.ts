import { z } from 'zod'

export const transactionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
})

const fixedExpenseBase = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  dueDay: z
    .string()
    .min(1, 'Dia é obrigatório')
    .refine((v) => Number(v) >= 1 && Number(v) <= 31, 'Deve ser entre 1 e 31'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
})

export const fixedExpenseEditSchema = fixedExpenseBase

export const fixedExpenseSchema = fixedExpenseBase.extend({
  referenceMonth: z.string().min(1, 'Mês é obrigatório'),
})

export const installmentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  totalAmount: z.string().min(1, 'Valor é obrigatório'),
  totalInstallments: z
    .string()
    .min(1, 'Informe o número de parcelas')
    .refine((v) => Number(v) >= 2 && Number(v) <= 60, 'Entre 2 e 60 parcelas'),
  startDate: z.string().min(1, 'Data é obrigatória'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
})

const incomeBase = z.object({
  source: z.string().min(1, 'Origem é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
})

export const incomeEditSchema = incomeBase

export const incomeSchema = incomeBase.extend({
  referenceMonth: z.string().min(1, 'Mês é obrigatório'),
})

export const installmentGroupSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
})
