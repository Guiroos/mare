'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FaturaPaymentDialog } from './FaturaPaymentDialog'
import { OverdueCycleCard } from './OverdueCycleCard'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, referenceMonthToYearMonth } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import type { OpenFatura } from '@/lib/queries/fatura'

type DebitAccount = { id: string; name: string; type: string }

type CardState = 'alert' | 'open' | 'paid'

function deriveState(data: OpenFatura): CardState {
  if (data.closedCycle.payment === null && data.closedCycle.total > 0) return 'alert'
  if (data.openCycle.total > 0) return 'open'
  return 'paid'
}

function formatCycleRange(start: string, end: string) {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-')
    return `${day}/${m}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

function formatMonthLabel(referenceMonth: string) {
  const ym = referenceMonthToYearMonth(referenceMonth)
  const [year, month] = ym.split('-')
  return `${month}/${year}`
}

interface FaturaCardProps {
  data: OpenFatura
  debitAccounts: DebitAccount[]
}

export function FaturaCard({ data, debitAccounts }: FaturaCardProps) {
  const state = deriveState(data)
  const isAlert = state === 'alert'
  const [dialogOpen, setDialogOpen] = useState(false)

  const cycle = isAlert ? data.closedCycle : data.openCycle
  const cycleRange = formatCycleRange(cycle.cycleStart, cycle.cycleEnd)

  return (
    <>
      {data.overdueCycles.map((overdue) => (
        <OverdueCycleCard
          key={overdue.cycleMonth}
          account={data.account}
          cycle={overdue}
          debitAccounts={debitAccounts}
        />
      ))}

      <div
        className={cn(
          'relative flex flex-col gap-3 overflow-hidden rounded-lg border p-5 shadow-sm',
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:rounded-t-lg before:content-['']",
          isAlert
            ? 'border-warning bg-warning-subtle before:bg-warning'
            : 'border-border bg-bg-surface before:bg-accent'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          {isAlert ? (
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
          ) : (
            <CreditCard className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
          )}
          <span className="text-caption font-medium text-text-secondary">{data.account.name}</span>
          <span className="ml-auto text-caption text-text-tertiary">
            {formatMonthLabel(cycle.cycleMonth)}
          </span>
        </div>

        {/* Cycle + amount */}
        <div className="flex items-end justify-between gap-4">
          <span className="text-small text-text-secondary">{cycleRange}</span>
          <span
            className={cn(
              'text-amount tabular-nums leading-none',
              isAlert ? 'text-warning' : 'text-text-primary'
            )}
          >
            {formatCurrency(cycle.total)}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-caption text-text-tertiary">
            {state === 'alert' && 'Vence em breve · não pago'}
            {state === 'open' &&
              `Vence após ${cycle.cycleEnd.slice(8, 10)}/${cycle.cycleEnd.slice(5, 7)}`}
            {state === 'paid' && data.closedCycle.payment && (
              <>Pago em {formatDate(data.closedCycle.payment.date)}</>
            )}
          </span>

          {isAlert && (
            <Button
              size="sm"
              variant="ghost"
              className="!bg-warning !text-text-inverse"
              onClick={() => setDialogOpen(true)}
            >
              Registrar pagamento
            </Button>
          )}
        </div>
      </div>

      {isAlert && (
        <FaturaPaymentDialog
          accountId={data.account.id}
          accountName={data.account.name}
          cycle={data.closedCycle}
          debitAccounts={debitAccounts}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  )
}
