'use client'

import { useState, useTransition } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { upsertBudgetOverride, deleteBudgetOverride } from '@/lib/actions/categories'
import { budgetOverrideSchema } from '@/lib/validations/categories'
import { formatZodErrors } from '@/lib/validations/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props = {
  categoryId: string
  categoryName: string
  referenceMonth: string
  defaultBudget: string | null
  override: { id: string; amount: string } | null
}

export function BudgetOverrideDialog({
  categoryId,
  categoryName,
  referenceMonth,
  defaultBudget,
  override,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const defaultBudgetLabel = defaultBudget
    ? Number(defaultBudget).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : null

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = new FormData(e.currentTarget).get('amount') as string

    const result = budgetOverrideSchema.safeParse({ amount })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await upsertBudgetOverride({
          categoryId,
          referenceMonth,
          amount: result.data.amount,
        })
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  const handleReset = () => {
    if (!override) return
    startTransition(async () => {
      try {
        await deleteBudgetOverride(override.id)
        setOpen(false)
      } catch {
        toast.error('Erro ao remover.')
      }
    })
  }

  const title = `Orçamento de ${categoryName}`

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Orçamento deste mês"
        hint={defaultBudgetLabel ? `Padrão: ${defaultBudgetLabel}` : undefined}
        required
        error={errors.amount}
      >
        <CurrencyInput
          name="amount"
          defaultValue={override?.amount ?? defaultBudget ?? ''}
          error={!!errors.amount}
          autoFocus
          preserveExplicitZero
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Definir'}
        </Button>
        {override && (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={isPending}
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Usar padrão
          </Button>
        )}
      </div>
    </form>
  )

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-text-tertiary hover:text-text-primary"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">{form}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
