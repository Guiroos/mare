'use client'

import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency, toAmount } from '@/lib/utils/currency'
import { parseDate, daysAgo, formatDisplayDate } from '@/lib/utils/date'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { deleteTransaction } from '@/lib/actions/transactions'
import { TransactionEditButton } from './TransactionEditDialog'
import { TxList, TxGroupHeader } from '@/components/ui/tx-list'
import { Chip } from '@/components/ui/chip'
import { Badge, BadgeVariant } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { RowActions } from '@/components/ui/row-actions'

const INITIAL_LIMIT = 5

type Transaction = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string | null
  accountId: string | null
  faturaAccountId: string | null
  installmentNumber: number | null
  totalInstallments: number | null
  category: { name: string; color: string | null; bgColor: string | null } | null
  account: { name: string; type: string } | null
  installmentGroup: { id: string } | null
}

type GroupBy = 'date' | 'account' | 'type'

const CHIP_LABELS: Record<GroupBy, string> = {
  date: 'Por data',
  account: 'Por conta',
  type: 'Por tipo',
}

const ACCOUNT_TYPE_DISPLAY: Record<string, { label: string; variant: BadgeVariant }> = {
  credit: { label: 'Crédito', variant: 'accent' },
  debit: { label: 'Débito', variant: 'muted' },
  pix: { label: 'PIX', variant: 'positive' },
}

type AccountGroup = {
  accountId: string | null
  accountName: string
  accountType: string | null
  total: number
  avulsaCount: number
  parceladaCount: number
  transactions: Transaction[]
}

function buildAccountGroups(transactions: Transaction[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>()

  for (const t of transactions) {
    const key = t.accountId ?? 'sem-conta'
    if (!map.has(key)) {
      map.set(key, {
        accountId: t.accountId,
        accountName: t.account?.name ?? 'Sem conta',
        accountType: t.account?.type ?? null,
        total: 0,
        avulsaCount: 0,
        parceladaCount: 0,
        transactions: [],
      })
    }
    const g = map.get(key)!
    g.total += toAmount(t.amount)
    if (t.installmentGroup === null) g.avulsaCount++
    else g.parceladaCount++
    g.transactions.push(t)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function buildTypeGroups(transactions: Transaction[]) {
  const avulsas = transactions.filter((t) => t.installmentGroup === null)
  const parceladas = transactions.filter((t) => t.installmentGroup !== null)
  return [
    { key: 'avulsa', label: 'Avulsas', items: avulsas },
    { key: 'parcelada', label: 'Parceladas', items: parceladas },
  ].filter((g) => g.items.length > 0)
}

function groupByDate(transactions: Transaction[]) {
  return transactions.reduce<{ date: string; items: Transaction[] }[]>((acc, t) => {
    const last = acc.at(-1)
    if (last?.date === t.date) last.items.push(t)
    else acc.push({ date: t.date, items: [t] })
    return acc
  }, [])
}

function formatGroupDate(dateStr: string): string {
  const diff = daysAgo(dateStr)
  const dayMonth = formatDisplayDate(dateStr)
  if (diff === 0) return `Hoje, ${dayMonth}`
  if (diff === 1) return `Ontem, ${dayMonth}`
  return `${format(parseDate(dateStr), "EEE'.'", { locale: ptBR })}, ${dayMonth}`
}

function getInitial(name: string) {
  return name.slice(0, 1).toUpperCase()
}

function TransactionRow({
  transaction: t,
  creditAccountIds,
}: {
  transaction: Transaction
  creditAccountIds: Set<string>
}) {
  const [editOpen, setEditOpen] = useState(false)
  const col = t.category ?? null
  const isViaFatura = t.accountId !== null && creditAccountIds.has(t.accountId)

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-bg-subtle">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-bg-subtle text-small font-semibold text-text-secondary"
        style={
          col?.bgColor || col?.color
            ? { background: col.bgColor ?? undefined, color: col.color ?? undefined }
            : undefined
        }
      >
        {getInitial(t.name)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{t.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
          {col && (
            <>
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: col.color ?? undefined }}
              />
              <span className="flex-shrink-0 text-caption font-medium text-text-secondary">
                {col.name}
              </span>
            </>
          )}
          {t.account && (
            <>
              <span className="flex-shrink-0 text-caption text-text-tertiary">·</span>
              <span className="truncate text-caption text-text-tertiary">{t.account.name}</span>
            </>
          )}
          {t.installmentNumber && t.totalInstallments && (
            <span className="ml-1 flex-shrink-0 rounded-sm border border-border bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
              {t.installmentNumber}/{t.totalInstallments}
            </span>
          )}
          {isViaFatura && (
            <span className="ml-1 flex-shrink-0 rounded-sm border border-border bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
              via fatura
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0">
        <span className="text-body font-semibold tabular-nums text-negative-text">
          − {formatCurrency(Number(t.amount))}
        </span>
      </div>

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

function AccordionHeader({
  children,
  isOpen,
  onToggle,
}: {
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors duration-fast hover:bg-bg-subtle"
    >
      {children}
      <ChevronDown
        className="h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-base"
        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
      />
    </button>
  )
}

function DateGroupedView({
  transactions,
  showAll,
  onShowAll,
  creditAccountIds,
}: {
  transactions: Transaction[]
  showAll: boolean
  onShowAll: () => void
  creditAccountIds: Set<string>
}) {
  const visible = showAll ? transactions : transactions.slice(0, INITIAL_LIMIT)
  const hiddenCount = transactions.length - visible.length
  const groups = groupByDate(visible)

  return (
    <>
      {groups.map(({ date, items }) => (
        <Fragment key={date}>
          <TxGroupHeader
            date={formatGroupDate(date)}
            total={`− ${formatCurrency(items.reduce((s, t) => s + Number(t.amount), 0))}`}
          />
          {items.map((t) => (
            <TransactionRow key={t.id} transaction={t} creditAccountIds={creditAccountIds} />
          ))}
        </Fragment>
      ))}
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={onShowAll}
          className="w-full bg-accent-subtle px-4 py-2.5 text-small font-medium text-accent-text transition-opacity hover:opacity-90"
        >
          Ver mais {hiddenCount} {hiddenCount === 1 ? 'transação' : 'transações'}
        </button>
      )}
    </>
  )
}

function AccountGroupedView({
  transactions,
  expanded,
  onToggle,
  creditAccountIds,
}: {
  transactions: Transaction[]
  expanded: Set<string>
  onToggle: (key: string) => void
  creditAccountIds: Set<string>
}) {
  const groups = buildAccountGroups(transactions)

  return (
    <>
      {groups.map((g) => {
        const key = g.accountId ?? 'sem-conta'
        const isOpen = expanded.has(key)
        const typeInfo = g.accountType ? ACCOUNT_TYPE_DISPLAY[g.accountType] : null

        const breakdownParts: string[] = []
        if (g.avulsaCount > 0)
          breakdownParts.push(`${g.avulsaCount} avulsa${g.avulsaCount > 1 ? 's' : ''}`)
        if (g.parceladaCount > 0)
          breakdownParts.push(`${g.parceladaCount} parcelada${g.parceladaCount > 1 ? 's' : ''}`)

        return (
          <div key={key} className="border-b border-border last:border-0">
            <AccordionHeader isOpen={isOpen} onToggle={() => onToggle(key)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-body font-semibold text-text-primary">
                    {g.accountName}
                  </span>
                  {typeInfo && (
                    <Badge variant={typeInfo.variant} size="sm">
                      {typeInfo.label}
                    </Badge>
                  )}
                </div>
                <span className="mt-0.5 block text-caption text-text-tertiary">
                  {breakdownParts.join(' · ')}
                </span>
              </div>
              <span className="shrink-0 text-body font-semibold tabular-nums text-negative-text">
                − {formatCurrency(g.total)}
              </span>
            </AccordionHeader>
            {isOpen && (
              <div className="border-t border-border">
                {g.transactions.map((t) => (
                  <TransactionRow key={t.id} transaction={t} creditAccountIds={creditAccountIds} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function TypeGroupedView({
  transactions,
  expanded,
  onToggle,
  creditAccountIds,
}: {
  transactions: Transaction[]
  expanded: Set<string>
  onToggle: (key: string) => void
  creditAccountIds: Set<string>
}) {
  const groups = buildTypeGroups(transactions)

  return (
    <>
      {groups.map((g) => {
        const isOpen = expanded.has(g.key)
        const total = g.items.reduce((s, t) => s + toAmount(t.amount), 0)
        const count = g.items.length

        return (
          <div key={g.key} className="border-b border-border last:border-0">
            <AccordionHeader isOpen={isOpen} onToggle={() => onToggle(g.key)}>
              <div className="min-w-0 flex-1">
                <span className="text-body font-semibold text-text-primary">{g.label}</span>
                <span className="mt-0.5 block text-caption text-text-tertiary">
                  {count} {count === 1 ? 'transação' : 'transações'}
                </span>
              </div>
              <span className="shrink-0 text-body font-semibold tabular-nums text-negative-text">
                − {formatCurrency(total)}
              </span>
            </AccordionHeader>
            {isOpen && (
              <div className="border-t border-border">
                {g.items.map((t) => (
                  <TransactionRow key={t.id} transaction={t} creditAccountIds={creditAccountIds} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

export function TransactionList({
  transactions,
  creditAccountIds: creditAccountIdsProp,
}: {
  transactions: Transaction[]
  creditAccountIds?: string[]
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>('date')
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const creditAccountIds = new Set(creditAccountIdsProp ?? [])

  const handleGroupBy = (next: GroupBy) => {
    setGroupBy(next)
    setShowAll(false)
    setExpanded(new Set())
  }

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (transactions.length === 0) {
    return <EmptyState title="Nenhuma transação registrada neste mês." />
  }

  return (
    <TxList>
      <div className="flex gap-2 border-b border-border px-4 py-3">
        {(['date', 'account', 'type'] as const).map((mode) => (
          <Chip key={mode} active={groupBy === mode} onClick={() => handleGroupBy(mode)}>
            {CHIP_LABELS[mode]}
          </Chip>
        ))}
      </div>

      {groupBy === 'date' && (
        <DateGroupedView
          transactions={transactions}
          showAll={showAll}
          onShowAll={() => setShowAll(true)}
          creditAccountIds={creditAccountIds}
        />
      )}
      {groupBy === 'account' && (
        <AccountGroupedView
          transactions={transactions}
          expanded={expanded}
          onToggle={toggleExpanded}
          creditAccountIds={creditAccountIds}
        />
      )}
      {groupBy === 'type' && (
        <TypeGroupedView
          transactions={transactions}
          expanded={expanded}
          onToggle={toggleExpanded}
          creditAccountIds={creditAccountIds}
        />
      )}
    </TxList>
  )
}
