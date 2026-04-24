'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { upsertInvestment, type UpsertInvestmentInput } from '@/lib/actions/investments'
import { formatMonthName, referenceMonthToYearMonth, currentYearMonth } from '@/lib/utils/date'
import { investmentEntrySchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'

type Existing = {
  id: string
  amount: number | null
  yieldAmount: number | null
  notes: string | null
  referenceMonth: string
}

type Props = {
  investmentTypeId: string
  existing?: Existing
}

export function InvestmentEntryDialog({ investmentTypeId, existing }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const defaultMonth = existing
    ? referenceMonthToYearMonth(existing.referenceMonth)
    : currentYearMonth()

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const selectedMonth = (fd.get('referenceMonth') as string).trim()

    const result = investmentEntrySchema.safeParse({
      investmentTypeId,
      referenceMonth: selectedMonth,
    })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    const data: UpsertInvestmentInput = {
      investmentTypeId,
      referenceMonth: result.data.referenceMonth + '-01',
      amount: (fd.get('amount') as string).trim() || null,
      yieldAmount: (fd.get('yieldAmount') as string).trim() || null,
      notes: (fd.get('notes') as string).trim() || null,
      existingId: existing?.id,
    }

    startTransition(async () => {
      try {
        await upsertInvestment(data)
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {existing ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-caption">
            <Plus className="h-3 w-3" />
            Registrar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar registro' : 'Novo registro'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field
            label="Mês de referência"
            hint={
              existing
                ? `O registro ficará em ${formatMonthName(referenceMonthToYearMonth(existing.referenceMonth))}.`
                : undefined
            }
            error={errors.referenceMonth}
          >
            <>
              <Input
                name="referenceMonth"
                type="month"
                defaultValue={defaultMonth}
                required
                disabled={!!existing}
                error={!!errors.referenceMonth}
              />
              {!!existing && <input type="hidden" name="referenceMonth" value={defaultMonth} />}
            </>
          </Field>
          <Field label="Aporte (R$)">
            <CurrencyInput name="amount" defaultValue={existing?.amount ?? ''} autoFocus />
          </Field>
          <Field label="Rendimento líquido (R$)">
            <CurrencyInput name="yieldAmount" defaultValue={existing?.yieldAmount ?? ''} />
          </Field>
          <Field label="Observações" hint="Opcional">
            <Input name="notes" defaultValue={existing?.notes ?? ''} />
          </Field>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
