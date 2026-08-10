import { Input, Field } from 'mare'

export const Basico = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Input defaultValue="Mercado do mês" />
    <Input placeholder="Ex: Aluguel" />
  </div>
)

export const Estados = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Input defaultValue="Valor normal" />
    <Input error defaultValue="Valor inválido" />
    <Input disabled defaultValue="Campo bloqueado" />
  </div>
)

export const Tipos = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <Field label="Data">
      <Input type="date" defaultValue="2026-08-07" />
    </Field>
    <Field label="Mês de referência">
      <Input type="month" defaultValue="2026-08" />
    </Field>
    <Field label="Dia do vencimento">
      <Input type="number" defaultValue="5" min={1} max={31} />
    </Field>
  </div>
)
