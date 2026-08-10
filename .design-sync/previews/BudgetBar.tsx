import { BudgetBar, Card } from 'mare'

export const TomAutomatico = () => (
  <Card padding="md" className="flex max-w-md flex-col gap-5">
    <BudgetBar current={412} target={600} label="Mercado" />
    <BudgetBar current={530} target={600} label="Transporte" />
    <BudgetBar current={710} target={600} label="Lazer" />
  </Card>
)

export const TomExplicito = () => (
  <Card padding="md" className="flex max-w-md flex-col gap-5">
    <BudgetBar current={180} target={400} label="Saúde" tone="ok" />
    <BudgetBar current={340} target={400} label="Casa" tone="warn" />
    <BudgetBar current={520} target={400} label="Assinaturas" tone="over" />
    <BudgetBar current={260} target={400} label="Educação" tone="accent" />
  </Card>
)

export const ComHint = () => (
  <Card padding="md" className="flex max-w-md flex-col gap-5">
    <BudgetBar current={412} target={600} label="Mercado" hint="restam R$ 188,00" />
    <BudgetBar current={710} target={600} label="Lazer" hint="R$ 110,00 acima" />
  </Card>
)
