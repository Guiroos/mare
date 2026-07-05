import { z } from 'zod'
import { uuidSchema, positiveAmountSchema, dateSchema, referenceMonthSchema } from './utils'

export const personSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  notes: z.string().optional(),
})

export const updatePersonActionSchema = personSchema.extend({ id: uuidSchema })

export const debtChargeSchema = z.object({
  personId: uuidSchema,
  amount: positiveAmountSchema,
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  entryDate: dateSchema,
  notes: z.string().optional(),
})

export const debtChargeFromTransactionSchema = debtChargeSchema.extend({
  sourceTransactionId: uuidSchema,
})

export const debtPaymentSchema = z
  .object({
    personId: uuidSchema,
    amount: positiveAmountSchema,
    description: z.string().min(1, 'Descrição é obrigatória').max(200),
    entryDate: dateSchema,
    createIncome: z.boolean(),
    referenceMonth: referenceMonthSchema.optional(),
    settleChargeIds: z.array(uuidSchema).optional(),
    reconcileRemainder: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => !data.createIncome || !!data.referenceMonth, {
    message: 'Mês de referência é obrigatório ao registrar como entrada',
    path: ['referenceMonth'],
  })

export const settleChargeSchema = z
  .object({
    chargeId: uuidSchema,
    personId: uuidSchema,
    entryDate: dateSchema,
    createIncome: z.boolean(),
    referenceMonth: referenceMonthSchema.optional(),
    notes: z.string().optional(),
  })
  .refine((data) => !data.createIncome || !!data.referenceMonth, {
    message: 'Mês de referência é obrigatório ao registrar como entrada',
    path: ['referenceMonth'],
  })
