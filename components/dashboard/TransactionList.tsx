'use client'

import { Fragment, useState } from 'react'
import { toAmount } from '@/lib/utils/currency'
import { SensitiveAmount, usePrivacyMode } from '@/components/providers/PrivacyMode'
import { formatDayGroupLabel } from '@/lib/utils/date'
import { deleteTransaction } from '@/lib/actions/transactions'
import { deleteIncome } from '@/lib/actions/incomes'
import { TransactionEditButton } from './TransactionEditDialog'
import { IncomeEditButton } from './IncomeEditDialog'
import { DashboardFAB } from './DashboardFAB'
import { TxList, TxGroupHeader } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { RowActions } from '@/components/ui/row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const INITIAL_LIMIT = 10

type Transaction = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string | null
  accountId: string | null
  tripId: string | null
  faturaAccountId: string | null
  installmentNumber: number | null
  totalInstallments: number | null
  category: { name: string; color: string | null; bgColor: string | null } | null
  account: { name: string; type: string } | null
  installmentGroup: { id: string } | null
}

type Income = {
  id: string
  source: string
  amount: string
  tripId: string | null
  canLinkTrip: boolean
}

// Entradas não têm coluna `date`: entram datadas no dia 1º do mês de referência,
// mesma convenção do feed do Histórico (collectHistoricoItems).
type FeedItem =
  | { kind: 'tx'; id: string; date: string; tx: Transaction }
  | { kind: 'income'; id: string; date: string; income: Income }

function buildFeed(transactions: Transaction[], incomes: Income[], month: string): FeedItem[] {
  const firstDay = `${month}-01`
  const items: FeedItem[] = [
    ...transactions.map((tx) => ({ kind: 'tx' as const, id: tx.id, date: tx.date, tx })),
    ...incomes.map((income) => ({
      kind: 'income' as const,
      id: income.id,
      date: firstDay,
      income,
    })),
  ]
  // sort é estável: transações (já em date desc) ficam antes das entradas no mesmo dia.
  return items.sort((a, b) => b.date.localeCompare(a.date))
}

function groupByDate(items: FeedItem[]) {
  return items.reduce<{ date: string; items: FeedItem[] }[]>((acc, item) => {
    const last = acc.at(-1)
    if (last?.date === item.date) last.items.push(item)
    else acc.push({ date: item.date, items: [item] })
    return acc
  }, [])
}

function signedAmount(item: FeedItem) {
  return item.kind === 'income' ? toAmount(item.income.amount) : -toAmount(item.tx.amount)
}

const rowCls =
  'group flex items-center gap-3 border-b border-border px-5 py-3 transition-colors duration-fast last:border-b-0 hover:bg-bg-subtle'

function TransactionRow({
  transaction: t,
  creditAccountIds,
}: {
  transaction: Transaction
  creditAccountIds: Set<string>
}) {
  const [editOpen, setEditOpen] = useState(false)
  const col = t.category
  const isViaFatura = t.accountId !== null && creditAccountIds.has(t.accountId)
  const meta = [col?.name, t.account?.name].filter(Boolean).join(' · ')
  const isInstallment = t.installmentNumber !== null && t.totalInstallments !== null
  // Parcela é gravada como "<nome> (i/N)"; o chip já mostra "i/N".
  const name = isInstallment ? t.name.replace(/ \(\d+\/\d+\)$/, '') : t.name

  return (
    <div className={rowCls}>
      <div
        // Cores de categoria são tons escuros sobre pastel, feitos para fundo claro:
        // no tema escuro o dot volta para o token (o `!` vence o style inline).
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-accent-subtle text-small font-semibold text-accent-text dark:!bg-accent-subtle dark:!text-accent-text"
        style={
          col?.bgColor || col?.color
            ? { background: col.bgColor ?? undefined, color: col.color ?? undefined }
            : undefined
        }
      >
        {name.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-body font-medium text-text-primary">{name}</p>
          {isInstallment && (
            <Badge size="sm" className="flex-shrink-0 rounded-sm px-1.5 py-0 tabular-nums">
              {t.installmentNumber}/{t.totalInstallments}
            </Badge>
          )}
          {isViaFatura && (
            <Badge size="sm" className="flex-shrink-0 rounded-sm px-1.5 py-0">
              via fatura
            </Badge>
          )}
        </div>
        {meta && <p className="truncate text-caption text-text-tertiary">{meta}</p>}
      </div>

      <span className="flex-shrink-0 text-body font-semibold tabular-nums text-text-primary">
        − <SensitiveAmount value={toAmount(t.amount)} />
      </span>

      {/* Parcela não tem ações aqui; reserva a largura do kebab para alinhar os valores. */}
      {t.installmentGroup && <span aria-hidden className="h-7 w-7 flex-shrink-0" />}
      {!t.installmentGroup && t.faturaAccountId && (
        <RowActions onDelete={() => deleteTransaction(t.id)} />
      )}
      {!t.installmentGroup && !t.faturaAccountId && (
        <>
          <RowActions onEdit={() => setEditOpen(true)} onDelete={() => deleteTransaction(t.id)} />
          <TransactionEditButton transaction={t} open={editOpen} onOpenChange={setEditOpen} />
        </>
      )}
    </div>
  )
}

function IncomeRow({ income }: { income: Income }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className={rowCls}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-positive-subtle text-small font-semibold text-positive-text">
        {income.source.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{income.source}</p>
        <p className="truncate text-caption text-text-tertiary">Entrada</p>
      </div>

      <span className="flex-shrink-0 text-body font-semibold tabular-nums text-positive">
        + <SensitiveAmount value={toAmount(income.amount)} />
      </span>

      <RowActions onEdit={() => setEditOpen(true)} onDelete={() => deleteIncome(income.id)} />
      <IncomeEditButton income={income} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}

export function TransactionList({
  transactions,
  incomes,
  creditAccountIds: creditAccountIdsProp,
  month,
  monthName,
}: {
  transactions: Transaction[]
  incomes: Income[]
  creditAccountIds?: string[]
  /** YYYY-MM */
  month: string
  /** "outubro" — usado nos textos do rodapé e do estado vazio. */
  monthName: string
}) {
  const [showAll, setShowAll] = useState(false)
  const { mask } = usePrivacyMode()

  const feed = buildFeed(transactions, incomes, month)

  if (feed.length === 0) {
    return (
      <TxList>
        <EmptyState
          title={`Nenhum lançamento em ${monthName}`}
          action={<DashboardFAB month={month} className="flex" />}
        />
      </TxList>
    )
  }

  const creditAccountIds = new Set(creditAccountIdsProp ?? [])
  const visible = showAll ? feed : feed.slice(0, INITIAL_LIMIT)
  const hiddenCount = feed.length - visible.length

  return (
    <TxList>
      {groupByDate(visible).map(({ date, items }) => {
        const net = items.reduce((s, item) => s + signedAmount(item), 0)
        return (
          <Fragment key={date}>
            <TxGroupHeader
              date={formatDayGroupLabel(date)}
              total={`${net >= 0 ? '+' : '−'} ${mask(Math.abs(net))}`}
            />
            {items.map((item) =>
              item.kind === 'tx' ? (
                <TransactionRow
                  key={item.id}
                  transaction={item.tx}
                  creditAccountIds={creditAccountIds}
                />
              ) : (
                <IncomeRow key={item.id} income={item.income} />
              )
            )}
          </Fragment>
        )
      })}
      {hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="md"
          onClick={() => setShowAll(true)}
          className="w-full rounded-none text-small font-semibold text-accent-text"
        >
          Ver as {feed.length} transações de {monthName}
        </Button>
      )}
    </TxList>
  )
}
