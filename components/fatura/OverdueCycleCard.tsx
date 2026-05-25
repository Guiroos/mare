'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FaturaPaymentDialog } from './FaturaPaymentDialog'
import { formatCurrency } from '@/lib/utils/currency'
import { referenceMonthToYearMonth } from '@/lib/utils/date'
import type { HistoricalUnpaidCycle, OpenFatura } from '@/lib/queries/fatura'

type DebitAccount = { id: string; name: string; type: string }

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

interface OverdueCycleCardProps {
  account: OpenFatura['account']
  cycle: HistoricalUnpaidCycle
  debitAccounts: DebitAccount[]
}

export function OverdueCycleCard({ account, cycle, debitAccounts }: OverdueCycleCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-lg border border-warning bg-warning-subtle p-5 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:rounded-t-lg before:bg-warning before:content-['']">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
          <span className="text-caption font-medium text-text-secondary">{account.name}</span>
          <span className="ml-auto text-caption text-text-tertiary">
            {formatMonthLabel(cycle.cycleMonth)}
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <span className="text-small text-text-secondary">
            {formatCycleRange(cycle.cycleStart, cycle.cycleEnd)}
          </span>
          <span className="text-amount tabular-nums leading-none text-warning">
            {formatCurrency(cycle.total)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-caption text-text-tertiary">Fatura em atraso</span>
          <Button
            size="sm"
            variant="ghost"
            className="!bg-warning !text-text-inverse"
            onClick={() => setDialogOpen(true)}
          >
            Registrar pagamento
          </Button>
        </div>
      </div>

      <FaturaPaymentDialog
        accountId={account.id}
        accountName={account.name}
        cycle={cycle}
        debitAccounts={debitAccounts}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
