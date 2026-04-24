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
import { formatMonth, referenceMonthToYearMonth, currentYearMonth } from '@/lib/format'

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

  const defaultMonth = existing
    ? referenceMonthToYearMonth(existing.referenceMonth)
    : currentYearMonth()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const amount = (fd.get('amount') as string).trim()
    const yieldAmount = (fd.get('yieldAmount') as string).trim()
    const notes = (fd.get('notes') as string).trim()
    const selectedMonth = (fd.get('referenceMonth') as string).trim()

    const data: UpsertInvestmentInput = {
      investmentTypeId,
      referenceMonth: selectedMonth + '-01',
      amount: amount || null,
      yieldAmount: yieldAmount || null,
      notes: notes || null,
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
    <Dialog open={open} onOpenChange={setOpen}>
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
              existing ? `O registro ficará em ${formatMonth(existing.referenceMonth)}.` : undefined
            }
          >
            <>
              <Input
                name="referenceMonth"
                type="month"
                defaultValue={defaultMonth}
                required
                disabled={!!existing}
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
