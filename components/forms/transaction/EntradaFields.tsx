import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Props = {
  errors: Record<string, string>
  month: string
}

export function EntradaFields({ errors, month }: Props) {
  return (
    <Field label="Mês de referência" error={errors.referenceMonth}>
      <Input
        name="referenceMonth"
        type="month"
        defaultValue={month}
        error={!!errors.referenceMonth}
        required
      />
    </Field>
  )
}
