'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import { toast } from 'sonner'
import { addGoalContribution } from '@/lib/actions/goals'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { contributionSchema } from '@/lib/validations/goals'
import { formatZodErrors } from '@/lib/validations/utils'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'

export function ContributionDialog({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const amount = (fd.get('amount') as string).trim()
    const referenceMonth = fd.get('referenceMonth') as string

    const result = contributionSchema.safeParse({ amount, referenceMonth })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await addGoalContribution({
          goalId,
          amount: result.data.amount,
          referenceMonth: yearMonthToReferenceMonth(result.data.referenceMonth),
        })
        setOpen(false)
      } catch {
        toast.error('Erro ao registrar aporte.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Valor (R$)" required error={errors.amount}>
        <CurrencyInput name="amount" error={!!errors.amount} required autoFocus />
      </Field>
      <Field label="Mês de referência" required error={errors.referenceMonth}>
        <Input
          name="referenceMonth"
          type="month"
          defaultValue={currentYearMonth()}
          error={!!errors.referenceMonth}
          required
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Registrar aporte
      </Button>

      {
        <ResponsiveDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="Registrar aporte manual"
        >
          {form}
        </ResponsiveDialog>
      }
    </>
  )
}
