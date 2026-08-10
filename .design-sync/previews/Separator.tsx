import { Separator, Card } from 'mare'

export const Horizontal = () => (
  <Card padding="md" className="max-w-sm">
    <div className="text-body text-text-primary">Entradas do mês</div>
    <Separator className="my-3" />
    <div className="text-body text-text-primary">Saídas do mês</div>
    <Separator className="my-3" />
    <div className="text-body text-text-primary">Investimentos</div>
  </Card>
)

export const Vertical = () => (
  <div className="flex h-12 items-center gap-4">
    <div className="text-body tabular-nums text-positive">+ R$ 5.200,00</div>
    <Separator orientation="vertical" />
    <div className="text-body tabular-nums text-negative">− R$ 3.140,00</div>
    <Separator orientation="vertical" />
    <div className="text-body tabular-nums text-text-primary">= R$ 2.060,00</div>
  </div>
)
