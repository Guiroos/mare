import { PageLayout, PageHeader, Section, Card, SummaryCard, Button, TxList, TxItem } from 'mare'
import { Plus } from 'lucide-react'

export const PaginaCompleta = () => (
  <PageLayout>
    <PageHeader title="Dashboard" description="Agosto de 2026" />

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard variant="positive" label="Entradas" amount="R$ 5.200,00" footer="1 lançamento" />
      <SummaryCard variant="negative" label="Saídas" amount="R$ 3.140,00" footer="12 lançamentos" />
      <SummaryCard variant="balance" label="Saldo" amount="R$ 2.060,00" footer="39% da renda" />
    </div>

    <Section
      title="Últimos lançamentos"
      action={
        <Button size="xs" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />}>
          Novo
        </Button>
      }
    >
      <TxList>
        <TxItem
          name="Mercado Pão de Açúcar"
          meta="Mercado · Nubank"
          amount="− R$ 248,90"
          amountTone="neg"
        />
        <TxItem name="Salário" meta="Entrada · Itaú" amount="+ R$ 5.200,00" amountTone="pos" />
      </TxList>
    </Section>

    <Section title="Orçamentos">
      <Card padding="md">
        <span className="text-body text-text-secondary">
          O PageLayout só aplica o espaçamento vertical (space-y-8) entre estes blocos.
        </span>
      </Card>
    </Section>
  </PageLayout>
)
