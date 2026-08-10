import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  Field,
} from 'mare'

export const Basico = () => (
  <div className="max-w-sm">
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
  </div>
)

export const Agrupado = () => (
  <div className="max-w-sm">
    <Field label="Categoria" required>
      <Select defaultValue="mercado">
        <SelectTrigger className="bg-bg-input">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Essenciais</SelectLabel>
            <SelectItem value="mercado">Mercado</SelectItem>
            <SelectItem value="moradia">Moradia</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Variáveis</SelectLabel>
            <SelectItem value="lazer">Lazer</SelectItem>
            <SelectItem value="viagem">Viagem</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  </div>
)

export const Estados = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Select defaultValue="itau">
      <SelectTrigger className="bg-bg-input">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="itau">Itaú — débito</SelectItem>
      </SelectContent>
    </Select>
    <Select defaultValue="itau">
      <SelectTrigger error className="bg-bg-input">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="itau">Itaú — débito</SelectItem>
      </SelectContent>
    </Select>
    <Select disabled defaultValue="itau">
      <SelectTrigger className="bg-bg-input">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="itau">Itaú — débito</SelectItem>
      </SelectContent>
    </Select>
  </div>
)

export const Compacto = () => (
  <Select defaultValue="90d">
    <SelectTrigger className="h-8 w-auto bg-bg-input text-caption">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="30d">Últimos 30 dias</SelectItem>
      <SelectItem value="90d">Últimos 90 dias</SelectItem>
      <SelectItem value="ano">Este ano</SelectItem>
    </SelectContent>
  </Select>
)
