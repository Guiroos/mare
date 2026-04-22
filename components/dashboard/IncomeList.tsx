'use client';

import { formatCurrency } from '@/lib/format';
import { deleteIncome } from '@/lib/actions/incomes';
import { DeleteButton } from '@/components/ui/delete-button';
import { IncomeEditButton } from './IncomeEditDialog';

type Income = {
  id: string;
  source: string;
  amount: string;
};

export function IncomeList({ incomes }: { incomes: Income[] }) {
  if (incomes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-[13px] font-medium text-text-secondary">
        Nenhuma entrada registrada neste mês.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-bg-surface shadow-mare-sm">
      {incomes.map((income) => (
        <div key={income.id} className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-positive-subtle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-positive">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </div>

          {/* Source */}
          <p className="flex-1 text-[14px] font-medium text-text-primary truncate">
            {income.source}
          </p>

          <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <IncomeEditButton income={income} />
            <DeleteButton onDelete={() => deleteIncome(income.id)} />
          </div>

          {/* Amount */}
          <span
            className="text-[14px] font-semibold tabular-nums flex-shrink-0 text-positive-text"
            style={{ letterSpacing: '-0.01em' }}
          >
            + {formatCurrency(Number(income.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}
