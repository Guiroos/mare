'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toast } from 'sonner'
import { updateGoalContribution } from '@/lib/actions/goals'
import { referenceMonthToYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { contributionSchema } from '@/lib/validations/goals'
import { formatZodErrors } from '@/lib/validations/utils'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'

type Contribution = {
  id: string
  amount: number | string
  referenceMonth: string
}

export function ContributionEditButton({ contribution }: { contribution: Contribution }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const amount = (fd.get('amount') as string) ?? ''
    const referenceMonth = fd.get('referenceMonth') as string

    const result = contributionSchema.safeParse({ amount, referenceMonth })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await updateGoalContribution({
          id: contribution.id,
          amount: result.data.amount,
          referenceMonth: yearMonthToReferenceMonth(result.data.referenceMonth),
        })
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Valor (R$)" required error={errors.amount}>
        <CurrencyInput
          name="amount"
          defaultValue={contribution.amount}
          error={!!errors.amount}
          required
          autoFocus
        />
      </Field>
      <Field label="Mês de referência" required error={errors.referenceMonth}>
        <Input
          name="referenceMonth"
          type="month"
          defaultValue={referenceMonthToYearMonth(contribution.referenceMonth)}
          error={!!errors.referenceMonth}
          required
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-text-secondary hover:text-text-primary"
        onClick={() => setOpen(true)}
        aria-label="Editar aporte"
      >
        <Pencil className="h-3 w-3" />
      </Button>

      {
        <ResponsiveDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="Editar aporte"
          className="max-w-sm"
        >
          {form}
        </ResponsiveDialog>
      }
    </>
  )
}
