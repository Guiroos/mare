'use client'

import { useState, useTransition } from 'react'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { updateDebtCharge } from '@/lib/actions/debtors'
import { updateDebtChargeSchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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

export function EditChargeDialog({ entry, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      id: entry.id,
      description: (fd.get('description') as string).trim(),
      entryDate: fd.get('entryDate') as string,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    const result = updateDebtChargeSchema.safeParse(data)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await updateDebtCharge(result.data)
        toast.success('Cobrança atualizada.')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao editar cobrança.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Valor">
        <p className="flex h-12 items-center text-body font-semibold tabular-nums text-text-primary">
          {formatCurrency(entry.amount)}
        </p>
      </Field>

      <Field label="Descrição" required error={errors.description}>
        <Input
          name="description"
          defaultValue={entry.description}
          error={!!errors.description}
          autoFocus
          required
        />
      </Field>

      <Field label="Data" required error={errors.entryDate}>
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
            <DialogTitle>Editar cobrança</DialogTitle>
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
          <DrawerTitle>Editar cobrança</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  )
}
