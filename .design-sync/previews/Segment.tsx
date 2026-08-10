import { Segment } from 'mare'

export const TipoDeLancamento = () => (
  <Segment
    options={[
      { value: 'saida', label: 'Saída', activeClassName: 'text-negative' },
      { value: 'entrada', label: 'Entrada', activeClassName: 'text-positive' },
      { value: 'fixo', label: 'Gasto fixo' },
    ]}
    value="saida"
  />
)

export const DuasOpcoes = () => (
  <Segment
    options={[
      { value: 'mes', label: 'Mês' },
      { value: 'ano', label: 'Ano' },
    ]}
    value="mes"
  />
)

export const LarguraTotal = () => (
  <div className="max-w-sm">
    <Segment
      className="w-full"
      options={[
        { value: 'avulsa', label: 'Avulsa' },
        { value: 'parcelada', label: 'Parcelada' },
        { value: 'fixa', label: 'Fixa' },
      ]}
      value="parcelada"
    />
  </div>
)
