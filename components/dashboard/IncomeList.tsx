'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { deleteIncome } from '@/lib/actions/incomes';
import { cn } from '@/lib/utils';

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
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteIncome(income.id);
    });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-opacity',
        isPending && 'opacity-40'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{income.source}</p>
      </div>

      <span className="text-sm font-semibold text-green-600 shrink-0">
        {formatCurrency(Number(income.amount))}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
        aria-label="Excluir"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
