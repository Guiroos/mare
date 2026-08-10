'use client'

import { useState, useTransition } from 'react'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { updateDebtEntry } from '@/lib/actions/debtors'
import { updateDebtEntrySchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { amountHints } from '@/lib/utils/debtorEntryHints'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segment } from '@/components/ui/segment'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from 'sonner'

type Props = {
  entry: DebtEntryDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}

type Sign = 'positive' | 'negative'

const TITLES: Record<DebtEntryDetail['type'], string> = {
  charge: 'Editar cobrança',
  payment: 'Editar pagamento',
  adjustment: 'Editar ajuste',
}

export function EditEntryDialog({ entry, open, onOpenChange }: Props) {
  const isAdjustment = entry.type === 'adjustment'
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sign, setSign] = useState<Sign>(entry.amount < 0 ? 'negative' : 'positive')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v)
    if (!v) {
      setErrors({})
      setSign(entry.amount < 0 ? 'negative' : 'positive')
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      id: entry.id,
      amount: fd.get('amount') as string,
      amountSign: isAdjustment ? sign : undefined,
      description: (fd.get('description') as string).trim(),
      entryDate: fd.get('entryDate') as string,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    const result = updateDebtEntrySchema.safeParse(data)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await updateDebtEntry(result.data)
        toast.success('Lançamento atualizado.')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao editar lançamento.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isAdjustment && (
        <Field label="Tipo de ajuste">
          <Segment<Sign>
            className="w-full"
            value={sign}
            onChange={setSign}
            options={[
              { value: 'negative', label: 'Abatimento (−)', activeClassName: 'text-positive' },
              { value: 'positive', label: 'Acréscimo (+)', activeClassName: 'text-negative' },
            ]}
          />
        </Field>
      )}

      <Field label="Valor" required error={errors.amount} hint={amountHints(entry)}>
        <CurrencyInput
          name="amount"
          defaultValue={Math.abs(entry.amount).toFixed(2)}
          error={!!errors.amount}
          autoFocus
          required
        />
      </Field>

      <Field label="Descrição" required error={errors.description}>
        <Input
          name="description"
          defaultValue={entry.description}
          error={!!errors.description}
          required
        />
      </Field>

      <Field
        label="Data"
        required
        error={errors.entryDate}
        hint={
          entry.incomeId
            ? 'O mês de referência da entrada vinculada não muda com a data.'
            : undefined
        }
      >
        <Input
          name="entryDate"
          type="date"
          defaultValue={entry.entryDate}
          error={!!errors.entryDate}
          required
        />
      </Field>

      <Field label="Observações" error={errors.notes}>
        <Textarea
          name="notes"
          defaultValue={entry.notes ?? ''}
          placeholder="Informações adicionais..."
          rows={2}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="md" onClick={() => handleOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? '...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{TITLES[entry.type]}</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{TITLES[entry.type]}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  )
}
