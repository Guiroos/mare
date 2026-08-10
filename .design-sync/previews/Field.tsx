import {
  Field,
  Input,
  Textarea,
  CurrencyInput,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from 'mare'

export const Basico = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Field label="Descrição">
      <Input defaultValue="Mercado do mês" />
    </Field>
    <Field label="Valor" required>
      <CurrencyInput name="amount" defaultValue="428.90" />
    </Field>
  </div>
)

export const ComHint = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Field label="Orçamento da categoria" hint="Deixe em branco para usar o padrão da categoria.">
      <CurrencyInput name="budget" placeholder="R$ 0,00" />
    </Field>
    <Field label="Observação" hint="Aparece só no histórico — não entra no relatório.">
      <Textarea rows={3} placeholder="Ex: reembolso do condomínio" />
    </Field>
  </div>
)

export const ComErro = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Field label="Descrição" required error="Informe uma descrição.">
      <Input error defaultValue="" placeholder="Ex: Aluguel" />
    </Field>
    <Field label="Dia do vencimento" required error="O dia precisa estar entre 1 e 31.">
      <Input error defaultValue="42" />
    </Field>
  </div>
)

export const ComSelect = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Field label="Conta de pagamento" required>
      <Select defaultValue="nubank">
        <SelectTrigger className="bg-bg-input">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nubank">Nubank — crédito</SelectItem>
          <SelectItem value="itau">Itaú — débito</SelectItem>
          <SelectItem value="pix">Pix</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field label="Categoria" hint="Entradas não têm categoria.">
      <Select defaultValue="mercado">
        <SelectTrigger className="bg-bg-input">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mercado">Mercado</SelectItem>
          <SelectItem value="transporte">Transporte</SelectItem>
          <SelectItem value="lazer">Lazer</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </div>
)
