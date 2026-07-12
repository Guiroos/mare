import { Field } from '@/components/ui/field'
import { MonthSelect } from '@/components/ui/month-select'

type Props = {
  errors: Record<string, string>
  month: string
}

export function EntradaFields({ errors, month }: Props) {
  return (
    <Field label="Mês de referência" error={errors.referenceMonth}>
      <MonthSelect name="referenceMonth" defaultValue={month} error={!!errors.referenceMonth} />
    </Field>
  )
}
