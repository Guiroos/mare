import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  errors: Record<string, string>
  today: string
  destination: string
  onDestinationChange: (v: string) => void
}

export function ResgateFields({ errors, today, destination, onDestinationChange }: Props) {
  return (
    <>
      <Field label="Data do resgate" error={errors.date}>
        <Input name="date" type="date" defaultValue={today} error={!!errors.date} required />
      </Field>
      <Field label="Destino" error={errors.destination}>
        <Select value={destination} onValueChange={onDestinationChange}>
          <SelectTrigger error={!!errors.destination}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Caixa (uso pessoal / emergência)</SelectItem>
            <SelectItem value="reinvest">Reinvestimento (mostrar só rendimento)</SelectItem>
            <SelectItem value="transfer">Transferência entre investimentos</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Observações">
        <Input name="notes" placeholder="Opcional" />
      </Field>
    </>
  )
}
