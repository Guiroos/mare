import { DeleteButton, Card, TxList, TxItem } from 'mare'

export const EmLinha = () => (
  <Card padding="md" className="flex max-w-md items-center justify-between">
    <div>
      <div className="text-body font-medium text-text-primary">Assinatura de streaming</div>
      <div className="mt-0.5 text-caption text-text-tertiary">Gasto fixo · vence dia 12</div>
    </div>
    <DeleteButton
      onDelete={async () => {}}
      title="Excluir gasto fixo"
      description="O gasto some deste mês e dos próximos. Meses anteriores não mudam."
    />
  </Card>
)

export const TextosPadrao = () => (
  <div className="flex items-center gap-3">
    <span className="text-body text-text-secondary">
      Sem title/description, usa &quot;Excluir item&quot;
    </span>
    <DeleteButton onDelete={async () => {}} />
  </div>
)

export const EmCabecalhoDeCard = () => (
  <Card padding="none" className="max-w-md">
    <div className="flex items-center justify-between border-b border-border bg-bg-subtle px-5 py-3">
      <span className="text-caption font-semibold text-text-secondary">Notebook Dell — 10x</span>
      <DeleteButton
        onDelete={async () => {}}
        title="Excluir parcelamento"
        description="Todas as 10 parcelas serão removidas, inclusive as já pagas."
      />
    </div>
    <TxList className="rounded-none border-0 shadow-none">
      <TxItem name="Parcela 3/10" meta="Agosto · Nubank" amount="− R$ 620,00" amountTone="neg" />
      <TxItem name="Parcela 4/10" meta="Setembro · Nubank" amount="− R$ 620,00" amountTone="neg" />
    </TxList>
  </Card>
)
