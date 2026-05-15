'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { createDebtCharge, createDebtChargeFromTransaction } from '@/lib/actions/debtors'
import { debtChargeSchema, debtChargeFromTransactionSchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useMediaQuery } from '@/hooks/use-media-query'
import { TransactionForDebtLink } from '@/lib/queries/debtors'

const NO_TX = 'none'

type Props = {
  personId: string
  transactions?: TransactionForDebtLink[]
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function DebtChargeDialog({ personId, transactions, open: openProp, onOpenChange }: Props) {
  const controlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlled ? openProp! : internalOpen
  const setOpen = controlled ? onOpenChange! : setInternalOpen

  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sourceTxId, setSourceTxId] = useState<string | null>(null)
  const [amountCents, setAmountCents] = useState(0)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const today = new Date().toISOString().slice(0, 10)
  const selectedTx = transactions?.find((t) => t.id === sourceTxId) ?? null
  const showAmountWarning =
    selectedTx !== null && amountCents > 0 && amountCents / 100 > selectedTx.amount

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setErrors({})
      setSourceTxId(null)
      setAmountCents(0)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const base = {
      personId,
      amount: fd.get('amount') as string,
      description: (fd.get('description') as string).trim(),
      entryDate: fd.get('entryDate') as string,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    if (sourceTxId) {
      const data = { ...base, sourceTransactionId: sourceTxId }
      const result = debtChargeFromTransactionSchema.safeParse(data)
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createDebtChargeFromTransaction(result.data)
          setOpen(false)
        } catch {
          toast.error('Erro ao registrar cobrança.')
        }
      })
    } else {
      const result = debtChargeSchema.safeParse(base)
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createDebtCharge(result.data)
          setOpen(false)
        } catch {
          toast.error('Erro ao registrar cobrança.')
        }
      })
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Descrição" required error={errors.description}>
        <Input name="description" placeholder="Ex: Almoço" error={!!errors.description} autoFocus />
      </Field>
      <Field label="Valor" required error={errors.amount}>
        <CurrencyInput name="amount" error={!!errors.amount} onValueChange={setAmountCents} />
      </Field>
      {showAmountWarning && (
        <p className="text-caption text-warning">
          Valor maior que o da transação original ({formatCurrency(selectedTx!.amount)}).
        </p>
      )}
      <Field label="Data da dívida" required error={errors.entryDate}>
        <Input
          name="entryDate"
          type="date"
          defaultValue={today}
          error={!!errors.entryDate}
          required
        />
      </Field>
      {transactions && (
        <Field label="Transação de origem">
          <Select
            value={sourceTxId ?? NO_TX}
            onValueChange={(v) => setSourceTxId(v === NO_TX ? null : v)}
          >
            <SelectTrigger className="bg-bg-input">
              <SelectValue placeholder="Nenhuma (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TX}>Nenhuma (opcional)</SelectItem>
              {transactions.map((tx) => (
                <SelectItem key={tx.id} value={tx.id}>
                  {tx.name} · {formatCurrency(tx.amount)} · {formatDate(tx.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-caption text-text-tertiary">
            Exibindo transações dos últimos 6 meses. Para transações mais antigas, registre a
            cobrança sem vínculo.
          </p>
        </Field>
      )}
      <Field label="Observações" error={errors.notes}>
        <Textarea name="notes" placeholder="Informações adicionais..." rows={2} />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          Registrar
        </Button>
      </div>
    </form>
  )

  const trigger = !controlled ? (
    <Button variant="primary" size="md" onClick={() => setOpen(true)}>
      <Plus className="mr-1.5 h-4 w-4" />
      Registrar cobrança
    </Button>
  ) : null

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar cobrança</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Registrar cobrança</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{form}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
