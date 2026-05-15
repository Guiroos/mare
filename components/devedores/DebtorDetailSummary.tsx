'use client'

import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

type Summary = {
  balance: number
  totalCharged: number
  totalPaid: number
  lastMovement: string | null
  chargeCount: number
  paymentCount: number
}

type Props = {
  summary: Summary
  hasEntries: boolean
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="text-small font-semibold tabular-nums text-text-primary">{value}</span>
    </div>
  )
}

export function DebtorDetailSummary({ summary, hasEntries }: Props) {
  const { balance, totalCharged, totalPaid, lastMovement } = summary

  const badgeLabel = !hasEntries
    ? null
    : balance > 0
      ? 'Em aberto'
      : balance < 0
        ? 'Crédito'
        : 'Quitado'
  const badgeVariant = balance > 0 ? 'negative' : balance < 0 ? 'positive' : ('muted' as const)

  const balanceColor =
    balance > 0 ? 'text-negative' : balance < 0 ? 'text-positive' : 'text-text-tertiary'

  return (
    <div className="rounded-xl border bg-bg-surface shadow-sm">
      <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4">
        <div>
          <p className="text-caption text-text-secondary">Saldo atual</p>
          <p className={cn('text-h2 font-semibold tabular-nums', balanceColor)}>
            {formatCurrency(Math.abs(balance))}
          </p>
        </div>
        {badgeLabel && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      </div>

      {hasEntries && (
        <div className="grid grid-cols-3 gap-2 border-t px-4 py-3">
          <MetricCard label="Total cobrado" value={formatCurrency(totalCharged)} />
          <MetricCard label="Total recebido" value={formatCurrency(totalPaid)} />
          <MetricCard
            label="Último movimento"
            value={lastMovement ? formatDate(lastMovement) : '—'}
          />
        </div>
      )}
    </div>
  )
}
