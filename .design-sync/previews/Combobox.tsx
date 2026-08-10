import { useState } from 'react'
import { Combobox, Field } from 'mare'

const CATEGORIAS = [
  {
    id: 'essenciais',
    label: 'Essenciais',
    options: [
      { value: 'mercado', label: 'Mercado' },
      { value: 'moradia', label: 'Moradia' },
      { value: 'saude', label: 'Saúde' },
    ],
  },
  {
    id: 'variaveis',
    label: 'Variáveis',
    options: [
      { value: 'lazer', label: 'Lazer' },
      { value: 'viagem', label: 'Viagem' },
      { value: 'presentes', label: 'Presentes' },
    ],
  },
]

const CONTAS = [
  { value: 'nubank', label: 'Nubank — crédito' },
  { value: 'itau', label: 'Itaú — débito' },
  { value: 'pix', label: 'Pix' },
]

export const ComSelecao = () => {
  const [value, setValue] = useState('mercado')
  return (
    <div className="max-w-sm">
      <Field label="Categoria" required>
        <Combobox groups={CATEGORIAS} value={value} onValueChange={setValue} />
      </Field>
    </div>
  )
}

export const Vazio = () => {
  const [value, setValue] = useState('')
  return (
    <div className="max-w-sm">
      <Field label="Conta de pagamento" hint="Digite para filtrar a lista.">
        <Combobox
          options={CONTAS}
          value={value}
          onValueChange={setValue}
          placeholder="Buscar conta..."
        />
      </Field>
    </div>
  )
}

export const ComErro = () => {
  const [value, setValue] = useState('')
  return (
    <div className="max-w-sm">
      <Field label="Categoria" required error="Escolha uma categoria.">
        <Combobox groups={CATEGORIAS} value={value} onValueChange={setValue} error />
      </Field>
    </div>
  )
}
