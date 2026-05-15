'use client'

import { useState } from 'react'
import { CheckCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { deleteDebtEntry } from '@/lib/actions/debtors'
import { Badge } from '@/components/ui/badge'
import { Chip } from '@/components/ui/chip'
import { RowActions } from '@/components/ui/row-actions'
import { PaymentWithIncomeDeleteDialog } from './PaymentWithIncomeDeleteDialog'
import { PaymentWithSettledChargesDeleteDialog } from './PaymentWithSettledChargesDeleteDialog'
import { SettleChargeDialog } from './SettleChargeDialog'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

type FilterType = 'all' | 'charge' | 'payment'

type Props = {
  entries: DebtEntryDetail[]
  personId: string
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatSettledChargesSummary(
  charges: Array<{ id: string; description: string; amount: number }>
): string {
  const shown = charges.slice(0, 2)
  const rest = charges.length - shown.length
  const parts = shown.map((c) => `${c.description} (${formatCurrency(c.amount)})`)
  if (rest > 0) parts.push(`+${rest}`)
  return parts.join(', ')
}

function EntryRow({
  entry,
  onDeleteWithIncome,
  onDeleteWithSettled,
  onSettle,
}: {
  entry: DebtEntryDetail
  onDeleteWithIncome: (entry: DebtEntryDetail) => void
  onDeleteWithSettled: (entry: DebtEntryDetail) => void
  onSettle: (entry: DebtEntryDetail) => void
}) {
  const isSettled = entry.status === 'settled'
  const isOpenCharge = entry.type === 'charge' && (entry.status === 'open' || entry.status === null)
  const isPaymentWithSettled = entry.type === 'payment' && entry.settledCharges.length > 0
  const isPaymentWithIncome = entry.type === 'payment' && !!entry.incomeId && !isPaymentWithSettled

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          entry.type === 'charge' || entry.type === 'adjustment'
            ? 'bg-negative-subtle'
            : 'bg-positive-subtle'
        )}
      >
        {entry.type === 'payment' ? (
          <TrendingUp className="h-4 w-4 text-positive" />
        ) : (
          <TrendingDown className="h-4 w-4 text-negative" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-small font-medium',
            isSettled ? 'text-text-tertiary line-through' : 'text-text-primary'
          )}
        >
          {entry.description}
        </span>
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-caption text-text-tertiary">
            {formatDate(entry.entryDate)}
          </span>
          {isSettled && (
            <>
              <span className="shrink-0 text-caption text-text-tertiary">·</span>
              <Badge variant="muted" size="sm">
                Quitada
              </Badge>
            </>
          )}
          {entry.sourceTransaction && !isSettled && (
            <>
              <span className="shrink-0 text-caption text-text-tertiary">·</span>
              <span className="truncate text-caption text-text-tertiary">
                {entry.sourceTransaction.name}
              </span>
            </>
          )}
          {entry.incomeId && !isPaymentWithSettled && (
            <>
              <span className="shrink-0 text-caption text-text-tertiary">·</span>
              <Badge variant="positive" size="sm">
                Entrada registrada
              </Badge>
            </>
          )}
          {isPaymentWithSettled && (
            <>
              <span className="shrink-0 text-caption text-text-tertiary">·</span>
              <span className="truncate text-caption text-text-tertiary">
                Quitou: {formatSettledChargesSummary(entry.settledCharges)}
              </span>
            </>
          )}
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 text-small font-semibold tabular-nums',
          entry.type === 'payment' ? 'text-positive' : 'text-negative'
        )}
      >
        {entry.type === 'payment' ? '+' : '-'}
        {formatCurrency(entry.amount)}
      </span>

      {isPaymentWithSettled ? (
        <RowActions
          additionalActions={[
            {
              label: 'Excluir',
              variant: 'destructive',
              onClick: () => onDeleteWithSettled(entry),
            },
          ]}
        />
      ) : isPaymentWithIncome ? (
        <RowActions
          additionalActions={[
            {
              label: 'Excluir',
              variant: 'destructive',
              onClick: () => onDeleteWithIncome(entry),
            },
          ]}
        />
      ) : isOpenCharge ? (
        <RowActions
          additionalActions={[
            {
              label: 'Quitar',
              icon: CheckCircle,
              onClick: () => onSettle(entry),
            },
          ]}
          onDelete={async () => {
            await deleteDebtEntry({ id: entry.id })
            toast.success('Lançamento excluído.')
          }}
          deleteTitle="Excluir lançamento"
          deleteDescription={`Excluir "${entry.description}"? O saldo da pessoa será recalculado.`}
        />
      ) : (
        <RowActions
          onDelete={async () => {
            await deleteDebtEntry({ id: entry.id })
            toast.success('Lançamento excluído.')
          }}
          deleteTitle="Excluir lançamento"
          deleteDescription={`Excluir "${entry.description}"? O saldo da pessoa será recalculado.`}
        />
      )}
    </div>
  )
}

export function DebtEntryList({ entries, personId }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [dialogEntry, setDialogEntry] = useState<DebtEntryDetail | null>(null)
  const [settledDeleteEntry, setSettledDeleteEntry] = useState<DebtEntryDetail | null>(null)
  const [settleEntry, setSettleEntry] = useState<DebtEntryDetail | null>(null)

  if (entries.length === 0) {
    return <p className="text-small text-text-tertiary">Nenhum lançamento registrado.</p>
  }

  const filters: { label: string; value: FilterType }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Cobranças', value: 'charge' },
    { label: 'Pagamentos', value: 'payment' },
  ]

  const filtered = entries.filter((e) => {
    if (filter === 'all') return true
    if (filter === 'charge') return e.type === 'charge' || e.type === 'adjustment'
    return e.type === 'payment'
  })

  // Group by month of entryDate (desc — entries already come desc from query)
  const groups: { month: string; entries: DebtEntryDetail[]; netTotal: number }[] = []
  for (const entry of filtered) {
    const month = entry.entryDate.slice(0, 7)
    let group = groups.find((g) => g.month === month)
    if (!group) {
      group = { month, entries: [], netTotal: 0 }
      groups.push(group)
    }
    group.entries.push(entry)
    group.netTotal += entry.type === 'payment' ? entry.amount : -entry.amount
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <Chip
            key={f.value}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
            className="h-8 rounded-md border text-caption"
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-small text-text-tertiary">
          Nenhum lançamento para o filtro selecionado.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.month}>
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-caption font-medium capitalize text-text-secondary">
                  {formatMonthLabel(group.month)}
                </span>
                <span
                  className={cn(
                    'text-caption font-semibold tabular-nums',
                    group.netTotal > 0
                      ? 'text-positive'
                      : group.netTotal < 0
                        ? 'text-negative'
                        : 'text-text-tertiary'
                  )}
                >
                  {group.netTotal > 0 ? '+' : group.netTotal < 0 ? '-' : ''}
                  {formatCurrency(Math.abs(group.netTotal))}
                </span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-xl border bg-bg-surface">
                {group.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDeleteWithIncome={setDialogEntry}
                    onDeleteWithSettled={setSettledDeleteEntry}
                    onSettle={setSettleEntry}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogEntry && (
        <PaymentWithIncomeDeleteDialog
          entry={dialogEntry}
          open={!!dialogEntry}
          onOpenChange={(v) => {
            if (!v) setDialogEntry(null)
          }}
        />
      )}

      {settledDeleteEntry && (
        <PaymentWithSettledChargesDeleteDialog
          entry={settledDeleteEntry}
          open={!!settledDeleteEntry}
          onOpenChange={(v) => {
            if (!v) setSettledDeleteEntry(null)
          }}
        />
      )}

      {settleEntry && (
        <SettleChargeDialog
          entry={settleEntry}
          personId={personId}
          open={!!settleEntry}
          onOpenChange={(v) => {
            if (!v) setSettleEntry(null)
          }}
        />
      )}
    </>
  )
}
