import { Section, Card, Button, BudgetBar } from 'mare'
import { Plus } from 'lucide-react'

export const Basico = () => (
  <Section title="Gastos fixos">
    <Card padding="md">
      <span className="text-body text-text-secondary">
        Aluguel, internet, academia e plano de saúde.
      </span>
    </Card>
  </Section>
)

export const ComAcao = () => (
  <Section
    title="Orçamentos por categoria"
    action={
      <Button size="xs" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />}>
        Definir
      </Button>
    }
  >
    <Card padding="md">
      <div className="flex flex-col gap-4">
        <BudgetBar current={412} target={600} label="Mercado" />
        <BudgetBar current={530} target={600} label="Transporte" />
        <BudgetBar current={710} target={600} label="Lazer" />
      </div>
    </Card>
  </Section>
)

export const Empilhadas = () => (
  <div className="space-y-8">
    <Section title="Este mês">
      <Card padding="md">
        <span className="text-body text-text-primary">R$ 3.140,00 em 12 lançamentos</span>
      </Card>
    </Section>
    <Section title="Mês anterior">
      <Card padding="md">
        <span className="text-body text-text-primary">R$ 2.980,50 em 15 lançamentos</span>
      </Card>
    </Section>
  </div>
)
