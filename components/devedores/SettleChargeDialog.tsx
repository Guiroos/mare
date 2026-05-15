'use client'

import { useState, useTransition } from 'react'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { settleCharge } from '@/lib/actions/debtors'
import { settleChargeSchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from 'sonner'

type Props = {
  entry: DebtEntryDetail
  personId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function SettleChargeDialog({ entry, personId, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [createIncome, setCreateIncome] = useState(true)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = currentYearMonth()

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v)
    if (!v) {
      setErrors({})
      setCreateIncome(true)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const referenceMonthRaw = fd.get('referenceMonth') as string

    const data = {
      chargeId: entry.id,
      personId,
      entryDate: fd.get('entryDate') as string,
      createIncome,
      referenceMonth:
        createIncome && referenceMonthRaw
          ? yearMonthToReferenceMonth(referenceMonthRaw)
          : undefined,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    const result = settleChargeSchema.safeParse(data)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await settleCharge(result.data)
        toast.success('Cobrança quitada.')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao quitar cobrança.')
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

      <Field label="Data do recebimento" required error={errors.entryDate}>
        <Input
          name="entryDate"
          type="date"
          defaultValue={today}
          error={!!errors.entryDate}
          required
        />
      </Field>

      <Switch
        label="Registrar também como entrada"
        checked={createIncome}
        onChange={setCreateIncome}
      />

      {createIncome && (
        <Field label="Mês de referência" required error={errors.referenceMonth}>
          <Input
            name="referenceMonth"
            type="month"
            defaultValue={currentMonth}
            error={!!errors.referenceMonth}
            required
          />
        </Field>
      )}

      <Field label="Observações" error={errors.notes}>
        <Textarea name="notes" placeholder="Informações adicionais..." rows={2} />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="md" onClick={() => handleOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? '...' : 'Quitar'}
        </Button>
      </div>
    </form>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quitar cobrança</DialogTitle>
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
          <DrawerTitle>Quitar cobrança</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  )
}
