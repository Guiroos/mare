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
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma entrada registrada neste mês.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {incomes.map((income) => (
        <IncomeRow key={income.id} income={income} />
      ))}
    </div>
  );
}

function IncomeRow({ income }: { income: Income }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{income.source}</p>
      </div>

      <span className="text-sm font-semibold text-green-600 shrink-0">
        {formatCurrency(Number(income.amount))}
      </span>

      <IncomeEditButton income={income} />
      <DeleteButton onDelete={() => deleteIncome(income.id)} />
    </div>
  );
}
