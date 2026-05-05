'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { upsertInvestment, type UpsertInvestmentInput } from '@/lib/actions/investments'
import { formatMonthName, referenceMonthToYearMonth, currentYearMonth } from '@/lib/utils/date'
import { investmentEntrySchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

type Existing = {
  id: string
  amount: number | null
  yieldAmount: number | null
  notes: string | null
  referenceMonth: string
  excludeFromCashFlow: boolean | null
}

type Props = {
  investmentTypeId: string
  existing?: Existing
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

function EntryForm({ investmentTypeId, existing, onSuccess }: Props & { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [excludeFromCashFlow, setExcludeFromCashFlow] = useState(
    existing?.excludeFromCashFlow ?? false
  )

  const defaultMonth = existing
    ? referenceMonthToYearMonth(existing.referenceMonth)
    : currentYearMonth()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const selectedMonth = (fd.get('referenceMonth') as string).trim()

    const result = investmentEntrySchema.safeParse({
      investmentTypeId,
      referenceMonth: selectedMonth,
      amount: (fd.get('amount') as string).trim() || undefined,
      yieldAmount: (fd.get('yieldAmount') as string).trim() || undefined,
    })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    const data: UpsertInvestmentInput = {
      investmentTypeId,
      referenceMonth: result.data.referenceMonth + '-01',
      amount: (fd.get('amount') as string).trim() || null,
      yieldAmount: (fd.get('yieldAmount') as string).trim() || null,
      notes: (fd.get('notes') as string).trim() || null,
      excludeFromCashFlow,
      existingId: existing?.id,
    }

    startTransition(async () => {
      try {
        await upsertInvestment(data)
        onSuccess()
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Mês de referência"
        hint={
          existing
            ? `O registro ficará em ${formatMonthName(referenceMonthToYearMonth(existing.referenceMonth))}.`
            : undefined
        }
        error={errors.referenceMonth}
      >
        <>
          <Input
            name="referenceMonth"
            type="month"
            defaultValue={defaultMonth}
            required
            disabled={!!existing}
            error={!!errors.referenceMonth}
          />
          {!!existing && <input type="hidden" name="referenceMonth" value={defaultMonth} />}
        </>
      </Field>
      <Field label="Aporte (R$)" error={errors.amount}>
        <CurrencyInput
          name="amount"
          defaultValue={existing?.amount ?? ''}
          autoFocus
          error={!!errors.amount}
        />
      </Field>
      <Field label="Rendimento líquido (R$)" error={errors.yieldAmount}>
        <CurrencyInput
          name="yieldAmount"
          defaultValue={existing?.yieldAmount ?? ''}
          error={!!errors.yieldAmount}
        />
      </Field>
      <Field label="Observações" hint="Opcional">
        <Input name="notes" defaultValue={existing?.notes ?? ''} />
      </Field>
      <Switch
        label="Já tinha esse valor (não contar como saída do mês)"
        checked={excludeFromCashFlow}
        onChange={setExcludeFromCashFlow}
      />
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}

export function InvestmentEntryDialog({
  investmentTypeId,
  existing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const title = existing ? 'Editar registro' : 'Novo registro'
  const trigger =
    !isControlled &&
    (existing ? (
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-text-tertiary hover:text-text-primary"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-caption"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3" />
        Registrar
      </Button>
    ))

  const form = (
    <EntryForm
      investmentTypeId={investmentTypeId}
      existing={existing}
      onSuccess={() => setOpen(false)}
    />
  )

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
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
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{form}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
