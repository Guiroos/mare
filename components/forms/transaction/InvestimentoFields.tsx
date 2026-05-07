import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

type Props = {
  errors: Record<string, string>
  month: string
  excludeFromCashFlow: boolean
  onExcludeChange: (v: boolean) => void
}

export function InvestimentoFields({ errors, month, excludeFromCashFlow, onExcludeChange }: Props) {
  return (
    <>
      <Field label="Mês de referência" error={errors.referenceMonth}>
        <Input
          name="referenceMonth"
          type="month"
          defaultValue={month}
          error={!!errors.referenceMonth}
          required
        />
      </Field>
      <Field label="Observações">
        <Input name="notes" placeholder="Opcional" />
      </Field>
      <Switch
        label="Excluir do fluxo de caixa"
        checked={excludeFromCashFlow}
        onChange={onExcludeChange}
      />
    </>
  )
}
