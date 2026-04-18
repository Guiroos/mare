'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { deleteTransaction } from '@/lib/actions/transactions';
import { cn } from '@/lib/utils';

type Transaction = {
  id: string;
  name: string;
  amount: string;
  date: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  category: { name: string } | null;
  account: { name: string } | null;
  installmentGroup: { id: string } | null;
};

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      await deleteTransaction(id);
      setDeletingId(null);
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma transação registrada neste mês.
      </div>
    );
  }

  const standalone = transactions.filter((t) => !t.installmentGroup);
  const installments = transactions.filter((t) => t.installmentGroup);

  return (
    <div className="space-y-1">
      {standalone.map((t) => (
        <TransactionRow
          key={t.id}
          transaction={t}
          deleting={deletingId === t.id}
          onDelete={handleDelete}
        />
      ))}
      {installments.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground pt-2 pb-1 px-1">
            Parcelas
          </p>
          {installments.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              deleting={deletingId === t.id}
              onDelete={handleDelete}
            />
          ))}
        </>
      )}
    </div>
  );
}

function TransactionRow({
  transaction: t,
  deleting,
  onDelete,
}: {
  transaction: Transaction;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  const [year, month, day] = t.date.split('-');
  const dateLabel = `${day}/${month}`;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-opacity',
        deleting && 'opacity-40'
      )}
    >
      <span className="text-xs text-muted-foreground w-10 shrink-0">{dateLabel}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{t.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {t.category && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {t.category.name}
            </Badge>
          )}
          {t.account && (
            <span className="text-xs text-muted-foreground">{t.account.name}</span>
          )}
        </div>
      </div>

      {t.installmentNumber && t.totalInstallments && (
        <span className="text-xs text-muted-foreground shrink-0">
          {t.installmentNumber}/{t.totalInstallments}
        </span>
      )}

      <span className="text-sm font-semibold text-red-600 shrink-0">
        {formatCurrency(Number(t.amount))}
      </span>

      {!t.installmentGroup && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(t.id)}
          disabled={deleting}
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
