import { z } from 'zod'
import { positiveAmountSchema, referenceMonthSchema, uuidSchema } from './utils'

export const faturaPaymentActionSchema = z.object({
  faturaAccountId: uuidSchema,
  faturaCycleMonth: referenceMonthSchema,
  sourceAccountId: uuidSchema,
  amount: positiveAmountSchema,
  date: z.string().date(),
})

export type FaturaPaymentActionInput = z.infer<typeof faturaPaymentActionSchema>
