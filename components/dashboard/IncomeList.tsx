'use client';

import { formatCurrency } from '@/lib/format';
import { deleteIncome } from '@/lib/actions/incomes';
import { DeleteButton } from '@/components/ui/delete-button';
import { IncomeEditButton } from './IncomeEditDialog';
import { TxList } from '@/components/ui/tx-list';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowUp } from 'lucide-react';

type Income = {
  id: string;
  source: string;
  amount: string;
};

export function IncomeList({ incomes }: { incomes: Income[] }) {
  if (incomes.length === 0) {
    return (
      <EmptyState title="Nenhuma entrada registrada neste mês." />
    );
  }

  return (
    <TxList>
      {incomes.map((income) => (
        <div key={income.id} className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
          {/* Icon */}
          <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-positive-subtle">
            <ArrowUp className="w-[18px] h-[18px] text-positive" strokeWidth={2} />
          </div>

          {/* Source */}
          <p className="flex-1 text-body font-medium text-text-primary truncate">
            {income.source}
          </p>

          <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <IncomeEditButton income={income} />
            <DeleteButton onDelete={() => deleteIncome(income.id)} />
          </div>

          {/* Amount */}
          <span className="text-body font-semibold tabular-nums flex-shrink-0 text-positive-text">
            + {formatCurrency(Number(income.amount))}
          </span>
        </div>
      ))}
    </TxList>
  );
}
