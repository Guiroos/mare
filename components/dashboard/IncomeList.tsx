'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { deleteIncome } from '@/lib/actions/incomes'
import { IncomeEditButton } from './IncomeEditDialog'
import { TxList } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { RowActions } from '@/components/ui/row-actions'
import { ArrowUp } from 'lucide-react'

type Income = {
  id: string
  source: string
  amount: string
}

function IncomeRow({ income }: { income: Income }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-bg-subtle">
      {/* Icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-positive-subtle">
        <ArrowUp className="h-[18px] w-[18px] text-positive" strokeWidth={2} />
      </div>

      {/* Source */}
      <p className="flex-1 truncate text-body font-medium text-text-primary">{income.source}</p>

      {/* Amount */}
      <span className="flex-shrink-0 text-body font-semibold tabular-nums text-positive-text">
        + {formatCurrency(Number(income.amount))}
      </span>

      <RowActions onEdit={() => setEditOpen(true)} onDelete={() => deleteIncome(income.id)} />
      <IncomeEditButton income={income} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}

export function IncomeList({ incomes }: { incomes: Income[] }) {
  if (incomes.length === 0) {
    return <EmptyState title="Nenhuma entrada registrada neste mês." />
  }

  return (
    <TxList>
      {incomes.map((income) => (
        <IncomeRow key={income.id} income={income} />
      ))}
    </TxList>
  )
}
