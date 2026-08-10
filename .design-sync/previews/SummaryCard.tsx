import { SummaryCard } from 'mare'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

export const Variantes = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <SummaryCard
      variant="positive"
      label="Entradas"
      amount="R$ 5.200,00"
      footer="1 lançamento em agosto"
    />
    <SummaryCard
      variant="negative"
      label="Saídas"
      amount="R$ 3.140,00"
      footer="12 lançamentos em agosto"
    />
    <SummaryCard variant="balance" label="Saldo" amount="R$ 2.060,00" footer="39% da renda" />
  </div>
)

export const ComIcone = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <SummaryCard
      variant="positive"
      label="Entradas"
      amount="R$ 5.200,00"
      icon={<TrendingUp className="h-4 w-4 text-positive" />}
    />
    <SummaryCard
      variant="negative"
      label="Saídas"
      amount="R$ 3.140,00"
      icon={<TrendingDown className="h-4 w-4 text-negative" />}
    />
    <SummaryCard
      variant="balance"
      label="Investido"
      amount="R$ 900,00"
      icon={<Wallet className="h-4 w-4 text-accent" />}
    />
  </div>
)

export const SemRodape = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <SummaryCard variant="balance" label="Patrimônio" amount="R$ 84.310,55" />
    <SummaryCard variant="positive" label="Rendimento no ano" amount="R$ 4.128,90" />
  </div>
)
