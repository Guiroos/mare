import { z } from 'zod'

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_root'
    if (!result[key]) result[key] = issue.message
  }
  return result
}

export const uuidSchema = z.string().uuid('ID inválido')

export const positiveAmountSchema = z
  .string()
  .min(1, 'Valor é obrigatório')
  .refine((v) => {
    const n = parseFloat(v)
    return !isNaN(n) && n > 0
  }, 'Valor deve ser maior que zero')

export const nonNegativeAmountSchema = z
  .string()
  .min(1, 'Valor é obrigatório')
  .refine((v) => {
    const n = parseFloat(v)
    return !isNaN(n) && n >= 0
  }, 'Valor inválido')

export const optionalPositiveAmountSchema = z
  .string()
  .optional()
  .refine(
    (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0),
    'Valor deve ser maior que zero'
  )

export const nullishNonNegativeAmountSchema = z
  .string()
  .nullish()
  .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Valor inválido')

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .refine((v) => !isNaN(Date.parse(v + 'T12:00:00')), 'Data inválida')

export const referenceMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, 'Mês de referência inválido')
