'use client'

import { useState, useTransition, Fragment } from 'react'
import { fetchMoreHistorico } from '@/lib/actions/historico'
import { TxList, TxGroupHeader } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { toAmount, formatCurrency } from '@/lib/utils/currency'
import { formatDisplayDate, daysAgo, parseDate } from '@/lib/utils/date'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'
import type { HistoricoFeedItem } from '@/lib/queries/historico'
import type { HistoricoParams, TipoKind } from '@/lib/utils/historico-params'

const KIND_LABEL: Record<TipoKind, string> = {
  saida_avulsa: 'Avulsa',
  saida_fixa: 'Fixa',
  saida_parcelada: 'Parcelada',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

const KIND_BADGE_CLASS: Record<TipoKind, string> = {
  saida_avulsa: 'bg-negative-subtle text-negative-text',
  saida_fixa: 'bg-warning-subtle text-warning-text',
  saida_parcelada: 'bg-negative-subtle text-negative-text',
  entrada: 'bg-positive-subtle text-positive-text',
  investimento: 'bg-accent-subtle text-accent-text',
  resgate: 'bg-positive-subtle text-positive-text',
}

function isDebit(kind: TipoKind) {
  return kind === 'saida_avulsa' || kind === 'saida_fixa' || kind === 'saida_parcelada'
}

function formatGroupDate(dateStr: string): string {
  const diff = daysAgo(dateStr)
  const dayMonth = formatDisplayDate(dateStr)
  if (diff === 0) return `Hoje, ${dayMonth}`
  if (diff === 1) return `Ontem, ${dayMonth}`
  return `${format(parseDate(dateStr), "EEE'.'", { locale: ptBR })}, ${dayMonth}`
}

function groupByDate(items: HistoricoFeedItem[]) {
  return items.reduce<{ date: string; items: HistoricoFeedItem[] }[]>((acc, item) => {
    const last = acc.at(-1)
    if (last?.date === item.date) last.items.push(item)
    else acc.push({ date: item.date, items: [item] })
    return acc
  }, [])
}

function SummaryCards({ items }: { items: HistoricoFeedItem[] }) {
  let entradas = 0
  let saidas = 0
  let investido = 0

  for (const item of items) {
    const amt = toAmount(item.amount)
    if (item.kind === 'entrada') entradas += amt
    else if (isDebit(item.kind)) saidas += amt
    else if (item.kind === 'investimento') investido += amt
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg bg-positive-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-positive-text">
          {formatCurrency(entradas)}
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">entradas</p>
      </div>
      <div className="rounded-lg bg-negative-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-negative-text">
          {formatCurrency(saidas)}
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">saídas</p>
      </div>
      <div className="rounded-lg bg-accent-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-accent-text">
          {formatCurrency(investido)}
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">investido</p>
      </div>
      <div className="rounded-lg border border-border bg-bg-surface p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-text-primary">{items.length}</p>
        <p className="mt-0.5 text-caption text-text-tertiary">itens</p>
      </div>
    </div>
  )
}

function FeedRow({ item }: { item: HistoricoFeedItem }) {
  const initial = item.name.slice(0, 1).toUpperCase()
  const debit = isDebit(item.kind)

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors duration-fast last:border-0 hover:bg-bg-subtle">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-bg-subtle text-small font-semibold text-text-secondary"
        style={
          item.categoryBgColor || item.categoryColor
            ? {
                background: item.categoryBgColor ?? undefined,
                color: item.categoryColor ?? undefined,
              }
            : undefined
        }
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{item.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {item.categoryName && (
            <>
              {item.categoryColor && (
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: item.categoryColor }}
                />
              )}
              <span className="flex-shrink-0 text-caption font-medium text-text-secondary">
                {item.categoryName}
              </span>
            </>
          )}
          {item.accountName && (
            <>
              <span className="flex-shrink-0 text-caption text-text-tertiary">·</span>
              <span className="truncate text-caption text-text-tertiary">{item.accountName}</span>
            </>
          )}
          {item.installmentNumber && item.totalInstallments && (
            <span className="ml-1 flex-shrink-0 rounded-sm border border-border bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
              {item.installmentNumber}/{item.totalInstallments}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'flex-shrink-0 rounded-sm px-1.5 py-0.5 text-label font-semibold',
          KIND_BADGE_CLASS[item.kind]
        )}
      >
        {KIND_LABEL[item.kind]}
      </span>

      <span
        className={cn(
          'flex-shrink-0 text-body font-semibold tabular-nums',
          debit
            ? 'text-negative-text'
            : item.kind === 'entrada'
              ? 'text-positive-text'
              : 'text-accent-text'
        )}
      >
        {debit ? '−' : '+'} {formatCurrency(toAmount(item.amount))}
      </span>
    </div>
  )
}

type Props = {
  initialItems: HistoricoFeedItem[]
  initialHasMore: boolean
  initialNextCursor: string | null
  params: HistoricoParams
}

export function HistoricoClient({
  initialItems,
  initialHasMore,
  initialNextCursor,
  params,
}: Props) {
  const [items, setItems] = useState(initialItems)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [isPending, startTransition] = useTransition()

  const loadMore = () => {
    if (!cursor) return
    startTransition(async () => {
      const result = await fetchMoreHistorico({ ...params, cursor })
      setItems((prev) => [...prev, ...result.items])
      setHasMore(result.hasMore)
      setCursor(result.nextCursor)
    })
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhuma movimentação encontrada"
        description="Tente ajustar o período ou os filtros."
      />
    )
  }

  const groups = groupByDate(items)

  return (
    <div className="space-y-4">
      <SummaryCards items={items} />

      <TxList>
        {groups.map(({ date, items: groupItems }) => (
          <Fragment key={date}>
            <TxGroupHeader
              date={formatGroupDate(date)}
              total={`${formatCurrency(groupItems.filter((i) => isDebit(i.kind)).reduce((s, i) => s + toAmount(i.amount), 0))} saídas`}
            />
            {groupItems.map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </Fragment>
        ))}
      </TxList>

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={loadMore} disabled={isPending}>
            {isPending ? 'Carregando...' : `Carregar mais`}
          </Button>
        </div>
      )}
    </div>
  )
}
