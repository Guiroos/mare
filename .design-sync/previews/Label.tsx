import { Label, Input } from 'mare'

export const Basico = () => (
  <div className="flex max-w-sm flex-col gap-2">
    <Label htmlFor="descricao">Descrição do lançamento</Label>
    <Input id="descricao" defaultValue="Assinatura de streaming" />
  </div>
)

export const EmCheckbox = () => (
  <div className="flex flex-col gap-2">
    <Label className="flex cursor-pointer items-center gap-2 text-text-primary">
      <input type="checkbox" className="accent-accent" defaultChecked readOnly />
      Incluir gastos fixos
    </Label>
    <Label className="flex cursor-pointer items-center gap-2 text-text-primary">
      <input type="checkbox" className="accent-accent" readOnly />
      Incluir investimentos
    </Label>
  </div>
)
