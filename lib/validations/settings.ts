import { z } from 'zod'
import { yearMonthSchema } from './utils'

export const creditModeSchema = z
  .object({
    creditMode: z.enum(['accrual', 'fatura']),
    faturaActiveFrom: yearMonthSchema.optional(),
  })
  .refine((d) => d.creditMode === 'accrual' || !!d.faturaActiveFrom, {
    message: 'Mês de ativação obrigatório para regime de fatura',
    path: ['faturaActiveFrom'],
  })

export type CreditModeInput = z.infer<typeof creditModeSchema>
