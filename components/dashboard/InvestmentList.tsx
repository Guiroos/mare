'use client'

import { useState } from 'react'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { deleteInvestment } from '@/lib/actions/investments'
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog'
import { TxList } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { RowActions } from '@/components/ui/row-actions'
import { TrendingUp } from 'lucide-react'

type Investment = {
  id: string
  amount: string | null
  yieldAmount: string | null
  notes: string | null
  referenceMonth: string
  investmentTypeId: string
  investmentType: { name: string }
  excludeFromCashFlow: boolean
}

function InvestmentRow({ inv }: { inv: Investment }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-bg-subtle">
      {/* Icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-accent-subtle">
        <TrendingUp className="h-[18px] w-[18px] text-accent" strokeWidth={2} />
      </div>

      {/* Name + notes */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">
          {inv.investmentType.name}
        </p>
        {inv.notes && (
          <p className="mt-0.5 truncate text-caption text-text-tertiary">{inv.notes}</p>
        )}
      </div>

      {/* Aporte + Rendimento */}
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-right">
        {inv.amount !== null && (
          <span className="text-small font-semibold tabular-nums text-text-primary">
            + <SensitiveAmount value={Number(inv.amount)} />
          </span>
        )}
        {inv.yieldAmount !== null ? (
          <span className="text-caption font-semibold tabular-nums text-positive-text">
            Rend. <SensitiveAmount value={Number(inv.yieldAmount)} />
          </span>
        ) : inv.amount !== null ? (
          <span className="text-caption font-medium text-warning-text">Rendimento pendente</span>
        ) : null}
      </div>

      <RowActions onEdit={() => setEditOpen(true)} onDelete={() => deleteInvestment(inv.id)} />
      <InvestmentEntryDialog
        investmentTypeId={inv.investmentTypeId}
        existing={{
          id: inv.id,
          amount: inv.amount !== null ? Number(inv.amount) : null,
          yieldAmount: inv.yieldAmount !== null ? Number(inv.yieldAmount) : null,
          notes: inv.notes,
          referenceMonth: inv.referenceMonth,
          excludeFromCashFlow: inv.excludeFromCashFlow,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  )
}

export function InvestmentList({ investments }: { investments: Investment[] }) {
  if (investments.length === 0) {
    return <EmptyState title="Nenhum registro de investimento neste mês." />
  }

  return (
    <TxList>
      {investments.map((inv) => (
        <InvestmentRow key={inv.id} inv={inv} />
      ))}
    </TxList>
  )
}
