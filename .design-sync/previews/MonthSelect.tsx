import { MonthSelect, Field } from 'mare'

export const Basico = () => (
  <div className="max-w-sm">
    <MonthSelect name="referenceMonth" defaultValue="2026-08" />
  </div>
)

export const EmField = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Field label="Mês de referência" required>
      <MonthSelect name="referenceMonth" defaultValue="2026-08" />
    </Field>
    <Field label="Primeira parcela" hint="O fechamento da conta pode empurrar para o mês seguinte.">
      <MonthSelect name="firstInstallment" defaultValue="2026-09" back={3} forward={24} />
    </Field>
  </div>
)

export const ComErro = () => (
  <div className="max-w-sm">
    <Field label="Mês de referência" required error="Selecione um mês.">
      <MonthSelect name="referenceMonth" defaultValue="2026-08" error />
    </Field>
  </div>
)
