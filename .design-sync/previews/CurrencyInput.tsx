import { CurrencyInput, Field } from 'mare'

export const Basico = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <CurrencyInput name="amount" defaultValue="428.90" />
    <CurrencyInput name="amount_vazio" />
  </div>
)

export const EmField = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Field label="Valor da saída" required>
      <CurrencyInput name="amount" defaultValue="1249.9" />
    </Field>
    <Field label="Orçamento da categoria" hint="Zero é um valor válido aqui.">
      <CurrencyInput name="budget" defaultValue="0" preserveExplicitZero />
    </Field>
  </div>
)

export const ComErro = () => (
  <div className="max-w-sm">
    <Field label="Valor" required error="O valor precisa ser maior que zero.">
      <CurrencyInput name="amount" error />
    </Field>
  </div>
)
