'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { toggleFixedExpensePaid } from '@/lib/actions/transactions';
import { cn } from '@/lib/utils';

type FixedExpense = {
  id: string;
  name: string;
  amount: string;
  dueDay: number;
  paid: boolean;
  category: { name: string } | null;
  account: { name: string } | null;
};

export function FixedExpenseList({ expenses }: { expenses: FixedExpense[] }) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum gasto fixo neste mês.
      </div>
    );
  }

  const pending = expenses.filter((e) => !e.paid);
  const paid = expenses.filter((e) => e.paid);

  return (
    <div className="space-y-1">
      {pending.map((e) => (
        <FixedExpenseRow key={e.id} expense={e} />
      ))}
      {paid.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground pt-2 pb-1 px-1">
            Pagos
          </p>
          {paid.map((e) => (
            <FixedExpenseRow key={e.id} expense={e} />
          ))}
        </>
      )}
    </div>
  );
}

function FixedExpenseRow({ expense: e }: { expense: FixedExpense }) {
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      await toggleFixedExpensePaid(e.id, !e.paid);
    });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-opacity',
        isPending && 'opacity-40'
      )}
    >
      <button
        onClick={toggle}
        disabled={isPending}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          e.paid
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-muted-foreground hover:border-primary'
        )}
        aria-label={e.paid ? 'Marcar como pendente' : 'Marcar como pago'}
      >
        {e.paid && <Check className="h-3 w-3" />}
      </button>

      <span className="text-xs text-muted-foreground w-8 shrink-0">
        dia {e.dueDay}
      </span>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', e.paid && 'line-through text-muted-foreground')}>
          {e.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {e.category && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {e.category.name}
            </Badge>
          )}
          {e.account && (
            <span className="text-xs text-muted-foreground">{e.account.name}</span>
          )}
        </div>
      </div>

      <span className={cn('text-sm font-semibold shrink-0', e.paid ? 'text-muted-foreground' : 'text-red-600')}>
        {formatCurrency(Number(e.amount))}
      </span>
    </div>
  );
}
