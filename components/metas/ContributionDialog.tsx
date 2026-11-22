'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import { toast } from 'sonner'
import { addGoalContribution, updateGoalContribution } from '@/lib/actions/goals'
import {
  currentYearMonth,
  referenceMonthToYearMonth,
  yearMonthToReferenceMonth,
} from '@/lib/utils/date'
import { contributionSchema } from '@/lib/validations/goals'
import { formatZodErrors } from '@/lib/validations/utils'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'

type Props =
  | { mode: 'create'; goalId: string }
  | { mode: 'edit'; contribution: { id: string; amount: number | string; referenceMonth: string } }

export function ContributionDialog(props: Props) {
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
    const amount = ((fd.get('amount') as string) ?? '').trim()
    const referenceMonth = fd.get('referenceMonth') as string

    const result = contributionSchema.safeParse({ amount, referenceMonth })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    const payload = {
      amount: result.data.amount,
      referenceMonth: yearMonthToReferenceMonth(result.data.referenceMonth),
    }
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await addGoalContribution({ goalId: props.goalId, ...payload })
        } else {
          await updateGoalContribution({ id: props.contribution.id, ...payload })
        }
        setOpen(false)
      } catch {
        toast.error(
          props.mode === 'create' ? 'Erro ao registrar aporte.' : 'Erro ao salvar. Tente novamente.'
        )
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Valor (R$)" required error={errors.amount}>
        <CurrencyInput
          name="amount"
          defaultValue={props.mode === 'edit' ? props.contribution.amount : undefined}
          error={!!errors.amount}
          required
          autoFocus
        />
      </Field>
      <Field label="Mês de referência" required error={errors.referenceMonth}>
        <Input
          name="referenceMonth"
          type="month"
          defaultValue={
            props.mode === 'edit'
              ? referenceMonthToYearMonth(props.contribution.referenceMonth)
              : currentYearMonth()
          }
          error={!!errors.referenceMonth}
          required
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : props.mode === 'create' ? 'Salvar' : 'Salvar alterações'}
      </Button>
    </form>
  )

  return (
    <>
      {props.mode === 'create' ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Registrar aporte
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-text-secondary hover:text-text-primary"
          onClick={() => setOpen(true)}
          aria-label="Editar aporte"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={props.mode === 'create' ? 'Registrar aporte manual' : 'Editar aporte'}
        className={props.mode === 'edit' ? 'max-w-sm' : undefined}
      >
        {form}
      </ResponsiveDialog>
    </>
  )
}
