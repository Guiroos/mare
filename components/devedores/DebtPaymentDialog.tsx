'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { createDebtPayment } from '@/lib/actions/debtors'
import { debtPaymentSchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'
import { OpenChargeForLinking } from '@/lib/queries/debtors'
import { cn } from '@/lib/utils/cn'

type Props = {
  personId: string
  openCharges: OpenChargeForLinking[]
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function DebtPaymentDialog({ personId, openCharges, open: openProp, onOpenChange }: Props) {
  const controlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlled ? openProp! : internalOpen
  const setOpen = controlled ? onOpenChange! : setInternalOpen

  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [createIncome, setCreateIncome] = useState(true)
  const [paymentAmountCents, setPaymentAmountCents] = useState(0)
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([])
  const [chargesExpanded, setChargesExpanded] = useState(false)
  const [reconcile, setReconcile] = useState(true)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = currentYearMonth()

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setErrors({})
      setCreateIncome(true)
      setPaymentAmountCents(0)
      setSelectedChargeIds([])
      setChargesExpanded(false)
      setReconcile(true)
    }
  }

  const selectedTotal = openCharges
    .filter((c) => selectedChargeIds.includes(c.id))
    .reduce((sum, c) => sum + c.amount, 0)

  const paymentAmount = paymentAmountCents / 100
  const isOverAmount = selectedTotal > paymentAmount + 0.01
  const isExactAmount =
    selectedChargeIds.length > 0 && Math.abs(selectedTotal - paymentAmount) <= 0.01
  const remainder = isOverAmount ? Math.round((selectedTotal - paymentAmount) * 100) / 100 : 0

  function toggleCharge(id: string) {
    setSelectedChargeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const referenceMonthRaw = fd.get('referenceMonth') as string
    const data = {
      personId,
      amount: fd.get('amount') as string,
      description: (fd.get('description') as string).trim(),
      entryDate: fd.get('entryDate') as string,
      createIncome,
      referenceMonth:
        createIncome && referenceMonthRaw
          ? yearMonthToReferenceMonth(referenceMonthRaw)
          : undefined,
      settleChargeIds: selectedChargeIds.length > 0 ? selectedChargeIds : undefined,
      reconcileRemainder: isOverAmount && reconcile ? true : undefined,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    const result = debtPaymentSchema.safeParse(data)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await createDebtPayment(result.data)
        toast.success('Pagamento registrado.')
        handleOpenChange(false)
      } catch {
        toast.error('Erro ao registrar pagamento.')
      }
    })
  }

  const chargesSection =
    openCharges.length > 0 ? (
      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setChargesExpanded((v) => !v)}
          className="gap-1.5 px-0 text-caption font-medium text-text-secondary"
        >
          {chargesExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Vincular a cobranças abertas
          {openCharges.length > 0 && (
            <Badge variant="muted" size="sm">
              {openCharges.length}
            </Badge>
          )}
        </Button>

        {chargesExpanded && (
          <div className="space-y-1 rounded-lg border bg-bg-subtle p-3">
            {openCharges.map((charge) => {
              const checked = selectedChargeIds.includes(charge.id)
              return (
                <Label
                  key={charge.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 font-normal hover:bg-bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCharge(charge.id)}
                    className="accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate text-small text-text-primary">
                    {charge.description}
                  </span>
                  <span className="shrink-0 text-small tabular-nums text-text-secondary">
                    {formatCurrency(charge.amount)}
                  </span>
                </Label>
              )
            })}

            {selectedChargeIds.length > 0 && (
              <div
                className={cn(
                  'mt-2 flex items-center justify-between border-t pt-2 text-caption',
                  isOverAmount ? 'text-warning' : 'text-text-secondary'
                )}
              >
                <span className="tabular-nums">
                  {formatCurrency(selectedTotal)} de {formatCurrency(paymentAmount)} selecionado
                </span>
                {isExactAmount && (
                  <Badge variant="positive" size="sm">
                    Exato
                  </Badge>
                )}
              </div>
            )}

            {isOverAmount && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <div className="flex items-center justify-between text-caption text-text-secondary">
                  <span>Diferença a conciliar</span>
                  <span className="font-medium tabular-nums text-text-primary">
                    {formatCurrency(remainder)}
                  </span>
                </div>
                <Switch
                  label="Registrar diferença como ajuste (abatimento)"
                  checked={reconcile}
                  onChange={setReconcile}
                />
              </div>
            )}
          </div>
        )}
      </div>
    ) : null

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Descrição" required error={errors.description}>
        <Input
          name="description"
          placeholder="Ex: Reembolso do almoço"
          error={!!errors.description}
          autoFocus
        />
      </Field>
      <Field label="Valor" required error={errors.amount}>
        <CurrencyInput
          name="amount"
          error={!!errors.amount}
          onValueChange={(cents) => setPaymentAmountCents(cents)}
        />
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

      {chargesSection}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="md" onClick={() => handleOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          Registrar
        </Button>
      </div>
    </form>
  )

  const trigger = !controlled ? (
    <Button variant="secondary" size="md" className="flex-1" onClick={() => setOpen(true)}>
      <Plus className="mr-1.5 h-4 w-4" />
      Pagamento
    </Button>
  ) : null

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar pagamento</DialogTitle>
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
            <DrawerTitle>Registrar pagamento</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{form}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
