import { NumericInput, Field } from 'mare'

export const Basico = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <NumericInput name="quantity" defaultValue="12.5" />
    <NumericInput name="quantity_vazio" />
  </div>
)

export const EmHeroCard = () => (
  <div className="flex max-w-sm items-center gap-3">
    <span className="text-h2 text-text-secondary">R$</span>
    <NumericInput name="aporte" defaultValue="900" className="text-h2" />
  </div>
)

export const ComErro = () => (
  <div className="max-w-sm">
    <Field label="Rendimento do mês" error="Informe um número." required>
      <NumericInput name="yield" error preserveExplicitZero defaultValue="0" />
    </Field>
  </div>
)
