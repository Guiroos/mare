'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, TrendingUp } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  investmentTypeId?: string
  investmentTypes?: { id: string; name: string }[]
  existing?: Existing
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

function EntryForm({
  investmentTypeId: fixedTypeId,
  investmentTypes,
  existing,
  onSuccess,
}: Props & { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [excludeFromCashFlow, setExcludeFromCashFlow] = useState(
    existing?.excludeFromCashFlow ?? false
  )
  const [selectedTypeId, setSelectedTypeId] = useState(fixedTypeId ?? '')

  const defaultMonth = existing
    ? referenceMonthToYearMonth(existing.referenceMonth)
    : currentYearMonth()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const selectedMonth = (fd.get('referenceMonth') as string).trim()

    const result = investmentEntrySchema.safeParse({
      investmentTypeId: selectedTypeId,
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
      investmentTypeId: selectedTypeId,
      referenceMonth: result.data.referenceMonth + '-01',
      amount: (fd.get('amount') as string).trim() || null,
      yieldAmount: (fd.get('yieldAmount') as string).trim() || null,
      notes: (fd.get('notes') as string).trim() || null,
      excludeFromCashFlow,
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
      {investmentTypes && !fixedTypeId && (
        <Field label="Tipo de investimento" error={errors.investmentTypeId}>
          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger className="bg-bg-input">
              <SelectValue placeholder="Selecionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {investmentTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
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
          preserveExplicitZero
        />
      </Field>
      <Field label="Rendimento líquido (R$)" error={errors.yieldAmount}>
        <CurrencyInput
          name="yieldAmount"
          defaultValue={existing?.yieldAmount ?? ''}
          error={!!errors.yieldAmount}
          preserveExplicitZero
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
  investmentTypes,
  existing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const isGlobal = !investmentTypeId && !!investmentTypes
  const title = existing ? 'Editar registro' : 'Registrar aporte'

  const trigger =
    !isControlled &&
    (existing ? (
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-text-tertiary hover:text-text-primary"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    ) : isGlobal ? (
      <Button variant="primary" className="gap-2" onClick={() => setOpen(true)}>
        <TrendingUp className="h-4 w-4" />
        <span className="hidden sm:inline">Registrar aporte</span>
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-caption"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3" />
        Registrar mês
      </Button>
    ))

  const form = (
    <EntryForm
      investmentTypeId={investmentTypeId}
      investmentTypes={investmentTypes}
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
