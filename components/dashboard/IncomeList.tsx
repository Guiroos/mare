'use client'

import { formatCurrency } from '@/lib/utils/currency'
import { deleteIncome } from '@/lib/actions/incomes'
import { DeleteButton } from '@/components/ui/delete-button'
import { IncomeEditButton } from './IncomeEditDialog'
import { TxList } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowUp } from 'lucide-react'

type Income = {
  id: string
  source: string
  amount: string
}

export function IncomeList({ incomes }: { incomes: Income[] }) {
  if (incomes.length === 0) {
    return <EmptyState title="Nenhuma entrada registrada neste mês." />
  }

  return (
    <TxList>
      {incomes.map((income) => (
        <div
          key={income.id}
          className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-bg-subtle"
        >
          {/* Icon */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-positive-subtle">
            <ArrowUp className="h-[18px] w-[18px] text-positive" strokeWidth={2} />
          </div>

          {/* Source */}
          <p className="flex-1 truncate text-body font-medium text-text-primary">{income.source}</p>

          <div className="hidden items-center gap-1 lg:flex lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
            <IncomeEditButton income={income} />
            <DeleteButton onDelete={() => deleteIncome(income.id)} />
          </div>

          {/* Amount */}
          <span className="flex-shrink-0 text-body font-semibold tabular-nums text-positive-text">
            + {formatCurrency(Number(income.amount))}
          </span>
        </div>
      ))}
    </TxList>
  )
}
