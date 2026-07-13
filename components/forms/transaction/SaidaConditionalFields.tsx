import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MonthSelect } from '@/components/ui/month-select'

type Props = {
  resolvedType: 'avulso' | 'fixo' | 'parcelado'
  errors: Record<string, string>
  month: string
  today: string
  installments: number
  onInstallmentsChange: (n: number) => void
  previewAmount: string
  isPaid: boolean
  onIsPaidChange: (v: boolean) => void
  accountField?: ReactNode
  defaultDate?: string
  defaultDueDay?: number
}

export function SaidaConditionalFields({
  resolvedType,
  errors,
  month,
  today,
  installments,
  onInstallmentsChange,
  previewAmount,
  isPaid,
  onIsPaidChange,
  accountField,
  defaultDate,
  defaultDueDay,
}: Props) {
  if (resolvedType === 'avulso') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Data" error={errors.date}>
          <Input
            name="date"
            type="date"
            defaultValue={defaultDate ?? today}
            error={!!errors.date}
            required
          />
        </Field>
        {accountField}
      </div>
    )
  }

  if (resolvedType === 'fixo') {
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de vencimento" error={errors.dueDay}>
            <Input
              name="dueDay"
              type="number"
              min="1"
              max="31"
              placeholder="Ex: 10"
              defaultValue={defaultDueDay}
              error={!!errors.dueDay}
              required
            />
          </Field>
          <Field label="Mês de referência" error={errors.referenceMonth}>
            <MonthSelect
              name="referenceMonth"
              defaultValue={month}
              error={!!errors.referenceMonth}
            />
          </Field>
        </div>
        {accountField}
        <Switch label="Marcar como pago" checked={isPaid} onChange={onIsPaidChange} />
        <input type="hidden" name="isPaid" value={isPaid ? 'true' : 'false'} />
      </>
    )
  }

  if (resolvedType === 'parcelado') {
    return (
      <>
        <div className="space-y-2">
          <Label>Nº de parcelas</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="surface"
              size="icon"
              onClick={() => onInstallmentsChange(Math.max(2, installments - 1))}
            >
              −
            </Button>
            <span className="w-8 text-center text-body font-semibold text-text-primary">
              {installments}
            </span>
            <Button
              type="button"
              variant="surface"
              size="icon"
              onClick={() => onInstallmentsChange(Math.min(60, installments + 1))}
            >
              +
            </Button>
          </div>
          <input type="hidden" name="totalInstallments" value={installments} />
          {previewAmount && (
            <div className="rounded-md bg-accent-subtle px-3 py-2">
              <p className="text-small tabular-nums text-accent-text">
                {installments}× R${' '}
                {(parseFloat(previewAmount) / installments).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Data da 1ª parcela" error={errors.startDate}>
            <Input
              name="startDate"
              type="date"
              defaultValue={today}
              error={!!errors.startDate}
              required
            />
          </Field>
          {accountField}
        </div>
      </>
    )
  }

  return null
}
