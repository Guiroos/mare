'use client'

import { Fragment, useState } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { parseDate, daysAgo, formatDisplayDate } from '@/lib/utils/date'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { deleteTransaction } from '@/lib/actions/transactions'
import { DeleteButton } from '@/components/ui/delete-button'
import { TransactionEditButton } from './TransactionEditDialog'
import { TxList, TxGroupHeader } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'

const INITIAL_LIMIT = 5

type Transaction = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string | null
  accountId: string | null
  installmentNumber: number | null
  totalInstallments: number | null
  category: { name: string; color: string | null; bgColor: string | null } | null
  account: { name: string } | null
  installmentGroup: { id: string } | null
}

function getInitial(name: string) {
  return name.slice(0, 1).toUpperCase()
}

function formatGroupDate(dateStr: string): string {
  const diff = daysAgo(dateStr)
  const dayMonth = formatDisplayDate(dateStr)
  if (diff === 0) return `Hoje, ${dayMonth}`
  if (diff === 1) return `Ontem, ${dayMonth}`
  return `${format(parseDate(dateStr), "EEE'.'", { locale: ptBR })}, ${dayMonth}`
}

function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const col = t.category ?? null

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-bg-subtle">
      {/* Avatar */}
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-bg-subtle text-small font-semibold text-text-secondary"
        style={
          col?.bgColor || col?.color
            ? {
                background: col.bgColor ?? undefined,
                color: col.color ?? undefined,
              }
            : undefined
        }
      >
        {getInitial(t.name)}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{t.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {col && (
            <>
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: col.color ?? undefined }}
              />
              <span className="text-caption font-medium text-text-secondary">{col.name}</span>
            </>
          )}
          {t.account && (
            <>
              <span className="text-caption text-text-tertiary">·</span>
              <span className="text-caption text-text-tertiary">{t.account.name}</span>
            </>
          )}
          {t.installmentNumber && t.totalInstallments && (
            <span className="ml-1 rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
              {t.installmentNumber}/{t.totalInstallments}
            </span>
          )}
        </div>
      </div>

      {!t.installmentGroup && (
        <div className="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
          <TransactionEditButton transaction={t} />
          <DeleteButton onDelete={() => deleteTransaction(t.id)} />
        </div>
      )}

      {/* Right */}
      <div className="flex-shrink-0">
        <span className="text-body font-semibold tabular-nums text-negative-text">
          − {formatCurrency(Number(t.amount))}
        </span>
      </div>
    </div>
  )
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [showAll, setShowAll] = useState(false)

  if (transactions.length === 0) {
    return <EmptyState title="Nenhuma transação registrada neste mês." />
  }

  const visible = showAll ? transactions : transactions.slice(0, INITIAL_LIMIT)
  const hiddenCount = transactions.length - visible.length

  const groups = visible.reduce<{ date: string; items: Transaction[] }[]>((acc, t) => {
    const last = acc.at(-1)
    if (last?.date === t.date) last.items.push(t)
    else acc.push({ date: t.date, items: [t] })
    return acc
  }, [])

  return (
    <TxList>
      {groups.map(({ date, items }) => (
        <Fragment key={date}>
          <TxGroupHeader
            date={formatGroupDate(date)}
            total={`− ${formatCurrency(items.reduce((s, t) => s + Number(t.amount), 0))}`}
          />
          {items.map((t) => (
            <TransactionRow key={t.id} transaction={t} />
          ))}
        </Fragment>
      ))}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full bg-accent-subtle px-4 py-2.5 text-small font-medium text-accent-text transition-opacity hover:opacity-90"
        >
          Ver mais {hiddenCount} {hiddenCount === 1 ? 'transação' : 'transações'}
        </button>
      )}
    </TxList>
  )
}
