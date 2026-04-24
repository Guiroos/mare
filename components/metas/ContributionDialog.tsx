'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { addGoalContribution } from '@/lib/actions/goals'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/format'

export function ContributionDialog({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const amount = (fd.get('amount') as string).trim()
    const yearMonth = fd.get('referenceMonth') as string

    startTransition(async () => {
      try {
        await addGoalContribution({
          goalId,
          amount,
          referenceMonth: yearMonthToReferenceMonth(yearMonth),
        })
        setOpen(false)
      } catch {
        toast.error('Erro ao registrar aporte.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Registrar aporte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar aporte manual</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Valor (R$)" required>
            <CurrencyInput name="amount" required autoFocus />
          </Field>
          <Field label="Mês de referência" required>
            <Input name="referenceMonth" type="month" defaultValue={currentYearMonth()} required />
          </Field>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
