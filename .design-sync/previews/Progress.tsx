import { Progress } from 'mare'

export const Basico = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <Progress value={28} />
    <Progress value={64} />
    <Progress value={100} />
  </div>
)

export const Tons = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-small text-text-secondary">Reserva</span>
      <Progress value={82} indicatorClassName="bg-positive" className="h-1.5" />
      <span className="w-10 shrink-0 text-caption tabular-nums text-text-secondary">82%</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-small text-text-secondary">Viagem</span>
      <Progress value={47} indicatorClassName="bg-accent" className="h-1.5" />
      <span className="w-10 shrink-0 text-caption tabular-nums text-text-secondary">47%</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-small text-text-secondary">Troca de carro</span>
      <Progress value={12} indicatorClassName="bg-warning" className="h-1.5" />
      <span className="w-10 shrink-0 text-caption tabular-nums text-text-secondary">12%</span>
    </div>
  </div>
)

export const ComMax = () => (
  <div className="flex max-w-sm flex-col gap-2">
    <div className="flex items-baseline justify-between">
      <span className="text-small font-medium text-text-primary">Meta: reserva de emergência</span>
      <span className="text-caption tabular-nums text-text-secondary">R$ 18.400 / R$ 30.000</span>
    </div>
    <Progress value={18400} max={30000} indicatorClassName="bg-positive" />
  </div>
)
