import { MultiselectDropdown } from 'mare'

const TIPOS = [
  { value: 'saida', label: 'Saídas', group: 'Lançamentos' },
  { value: 'entrada', label: 'Entradas', group: 'Lançamentos' },
  { value: 'fixo', label: 'Gastos fixos', group: 'Lançamentos' },
  { value: 'aporte', label: 'Aportes', group: 'Investimentos' },
  { value: 'resgate', label: 'Resgates', group: 'Investimentos' },
]

const CONTAS = [
  { value: 'nubank', label: 'Nubank' },
  { value: 'itau', label: 'Itaú' },
  { value: 'pix', label: 'Pix' },
]

export const TudoSelecionado = () => (
  <MultiselectDropdown
    label="Tipos"
    options={TIPOS}
    selected={TIPOS.map((t) => t.value)}
    onChange={() => {}}
  />
)

export const SelecaoParcial = () => (
  <MultiselectDropdown
    label="Tipos"
    options={TIPOS}
    selected={['saida', 'fixo']}
    onChange={() => {}}
  />
)

export const BarraDeFiltros = () => (
  <div className="flex flex-wrap items-center gap-2">
    <MultiselectDropdown
      label="Tipos"
      options={TIPOS}
      selected={['saida', 'entrada']}
      onChange={() => {}}
    />
    <MultiselectDropdown
      label="Contas"
      options={CONTAS}
      selected={CONTAS.map((c) => c.value)}
      onChange={() => {}}
    />
  </div>
)
