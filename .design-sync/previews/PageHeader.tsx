import { PageHeader, Button } from 'mare'
import { Plus } from 'lucide-react'

export const Basico = () => <PageHeader title="Parcelas" />

export const ComDescricao = () => (
  <PageHeader
    title="Devedores"
    description="Quem te deve, quanto e desde quando. Cobranças e pagamentos ficam no histórico da pessoa."
  />
)

export const ComAcao = () => (
  <div className="flex items-start justify-between gap-4">
    <PageHeader
      title="Investimentos"
      description="Aportes, rendimentos e resgates por tipo de investimento."
    />
    <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
      Novo aporte
    </Button>
  </div>
)
