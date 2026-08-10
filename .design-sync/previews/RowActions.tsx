import { RowActions, TxList, Card } from 'mare'
import { Copy, Link2 } from 'lucide-react'

export const EmLinhaDeLista = () => (
  <TxList className="max-w-md">
    <div className="group flex items-center gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-medium text-text-primary">
          Mercado Pão de Açúcar
        </div>
        <div className="mt-0.5 text-caption text-text-tertiary">Mercado · Nubank</div>
      </div>
      <span className="shrink-0 text-body font-semibold tabular-nums text-negative-text">
        − R$ 248,90
      </span>
      <RowActions onEdit={() => {}} onDelete={async () => {}} />
    </div>
    <div className="group flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-medium text-text-primary">Salário</div>
        <div className="mt-0.5 text-caption text-text-tertiary">Entrada · Itaú</div>
      </div>
      <span className="shrink-0 text-body font-semibold tabular-nums text-positive-text">
        + R$ 5.200,00
      </span>
      <RowActions onEdit={() => {}} onDelete={async () => {}} />
    </div>
  </TxList>
)

export const SoExcluir = () => (
  <Card padding="md" className="group flex max-w-md items-center justify-between">
    <span className="text-body text-text-primary">Categoria sem histórico</span>
    <RowActions
      onDelete={async () => {}}
      deleteTitle="Excluir categoria"
      deleteDescription="Categorias com lançamentos não podem ser excluídas."
    />
  </Card>
)

export const ComAcoesExtras = () => (
  <Card padding="md" className="group flex max-w-md items-center justify-between">
    <span className="text-body text-text-primary">Ana Souza — R$ 320,00 em aberto</span>
    <RowActions
      onEdit={() => {}}
      onDelete={async () => {}}
      additionalActions={[
        { label: 'Copiar cobrança', icon: Copy, onClick: () => {} },
        { label: 'Abrir WhatsApp', icon: Link2, onClick: () => {} },
      ]}
    />
  </Card>
)
