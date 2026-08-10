import { Card, Badge, Button, Separator } from 'mare'

export const Paddings = () => (
  <div className="flex flex-col gap-3">
    <Card padding="sm">
      <span className="text-body text-text-primary">padding=&quot;sm&quot; — 16px</span>
    </Card>
    <Card padding="md">
      <span className="text-body text-text-primary">padding=&quot;md&quot; — 20px</span>
    </Card>
    <Card padding="lg">
      <span className="text-body text-text-primary">padding=&quot;lg&quot; — 24px</span>
    </Card>
  </div>
)

export const ConteudoReal = () => (
  <Card padding="lg" className="max-w-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-h3 text-text-primary">Nubank</h3>
        <p className="mt-1 text-small text-text-secondary">Crédito · fecha dia 8</p>
      </div>
      <Badge variant="warning">Fatura aberta</Badge>
    </div>
    <Separator className="my-4" />
    <div className="flex items-end justify-between">
      <div>
        <div className="text-caption text-text-tertiary">Ciclo atual</div>
        <div className="text-amount tabular-nums text-text-primary">R$ 1.842,30</div>
      </div>
      <Button size="sm" variant="surface">
        Ver fatura
      </Button>
    </div>
  </Card>
)

export const SemPadding = () => (
  <Card className="max-w-sm">
    <div className="border-b border-border bg-bg-subtle px-5 py-3 text-caption font-semibold text-text-secondary">
      padding=&quot;none&quot; — o filho controla o espaçamento
    </div>
    <div className="px-5 py-4 text-body text-text-primary">
      Use assim quando o card contém listas ou tabelas que precisam encostar na borda.
    </div>
  </Card>
)
