import { Badge } from 'mare'

export const Variantes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="positive">Pago</Badge>
    <Badge variant="negative">Atrasado</Badge>
    <Badge variant="accent">Fatura aberta</Badge>
    <Badge variant="warning">Vence hoje</Badge>
    <Badge variant="muted">Arquivado</Badge>
  </div>
)

export const Tamanhos = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="accent" size="sm">
      3/10
    </Badge>
    <Badge variant="accent" size="md">
      Parcelado
    </Badge>
    <Badge variant="accent" size="lg">
      Fatura de agosto
    </Badge>
  </div>
)

export const ComDot = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="muted" dot="oklch(50% 0.14 230)">
      Mercado
    </Badge>
    <Badge variant="muted" dot="oklch(54% 0.13 172)">
      Salário
    </Badge>
    <Badge variant="muted" dot="oklch(72% 0.14 75)">
      Lazer
    </Badge>
  </div>
)
