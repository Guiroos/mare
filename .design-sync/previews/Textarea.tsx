import { Textarea, Field } from 'mare'

export const Basico = () => (
  <div className="max-w-sm">
    <Textarea defaultValue="Reembolso do condomínio — combinado com o síndico em 03/08." />
  </div>
)

export const Estados = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Textarea placeholder="Observação (opcional)" />
    <Textarea error defaultValue="Texto acima do limite de caracteres" />
    <Textarea disabled defaultValue="Bloqueado enquanto a fatura estiver fechada" />
  </div>
)

export const EmField = () => (
  <div className="max-w-sm">
    <Field label="Observação" hint="Aparece só no histórico — não entra no relatório.">
      <Textarea rows={5} placeholder="Ex: dividir com a Ana no próximo mês" />
    </Field>
  </div>
)
