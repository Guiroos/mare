'use client';

import { useState, useTransition } from 'react';
import { formatCurrency } from '@/lib/format';
import { toggleFixedExpensePaid, deleteFixedExpense } from '@/lib/actions/transactions';
import { DeleteButton } from '@/components/ui/delete-button';
import { FixedExpenseEditButton } from './FixedExpenseEditDialog';
import { TxList } from '@/components/ui/tx-list';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';

type FixedExpense = {
  id: string;
  name: string;
  amount: string;
  dueDay: number;
  paid: boolean;
  categoryId: string | null;
  accountId: string | null;
  category: { name: string; color: string | null; bgColor: string | null } | null;
  account: { name: string } | null;
};

function DueBadge({ dueDay, paid, isCurrentMonth, todayDay, isPastMonth }: {
  dueDay: number;
  paid: boolean;
  isCurrentMonth: boolean;
  todayDay: number;
  isPastMonth: boolean;
}) {
  if (paid) return null;

  const daysUntil = dueDay - todayDay;
  const overdue = isPastMonth || (isCurrentMonth && daysUntil < 0);
  const urgent = isCurrentMonth && daysUntil >= 0 && daysUntil <= 3;

  if (overdue) {
    return (
      <span className="text-label px-1.5 py-0.5 rounded bg-negative-subtle text-negative-text">
        Vencido
      </span>
    );
  }
  if (urgent) {
    return (
      <span className="text-label px-1.5 py-0.5 rounded bg-warning-subtle text-warning-text">
        {daysUntil === 0 ? 'Vence hoje' : `Vence em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`}
      </span>
    );
  }
  return (
    <span className="text-label px-1.5 py-0.5 rounded bg-bg-subtle text-text-tertiary border border-border">
      Dia {dueDay}
    </span>
  );
}

function FixedExpenseRow({ expense: e, isCurrentMonth, todayDay, isPastMonth }: {
  expense: FixedExpense;
  isCurrentMonth: boolean;
  todayDay: number;
  isPastMonth: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const col = e.category;

  const toggle = () => {
    startTransition(async () => {
      await toggleFixedExpensePaid(e.id, !e.paid);
    });
  };

  return (
    <div className={cn('group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-subtle transition-all', isPending && 'opacity-40')}>
      {/* Checkbox */}
      <button
        onClick={toggle}
        disabled={isPending}
        aria-label={e.paid ? 'Marcar como pendente' : 'Marcar como pago'}
        className={cn(
          'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
          e.paid ? 'border-positive bg-positive' : 'border-border-strong bg-transparent'
        )}
      >
        {e.paid && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-body font-medium truncate', e.paid ? 'line-through text-text-tertiary' : 'text-text-primary')}>
          {e.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {col && (
            <>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: col.color ?? undefined }} />
              <span className="text-caption font-medium text-text-secondary">{col.name}</span>
            </>
          )}
          {e.account && (
            <>
              <span className="text-caption text-text-tertiary">·</span>
              <span className="text-caption text-text-tertiary">{e.account.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <FixedExpenseEditButton expense={e} />
        <DeleteButton onDelete={() => deleteFixedExpense(e.id)} />
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={cn('text-body font-semibold tabular-nums', e.paid ? 'text-text-tertiary' : 'text-negative-text')}>
          {formatCurrency(Number(e.amount))}
        </span>
        <DueBadge dueDay={e.dueDay} paid={e.paid} isCurrentMonth={isCurrentMonth} todayDay={todayDay} isPastMonth={isPastMonth} />
      </div>
    </div>
  );
}

export function FixedExpenseList({ expenses, yearMonth }: { expenses: FixedExpense[]; yearMonth: string }) {
  const [showPaid, setShowPaid] = useState(false);

  if (expenses.length === 0) {
    return (
      <EmptyState title="Nenhum gasto fixo neste mês." />
    );
  }

  const today = new Date();
  const [currentYear, currentMonth] = [today.getFullYear(), today.getMonth() + 1];
  const [displayYear, displayMonth] = yearMonth.split('-').map(Number);
  const isPastMonth = displayYear < currentYear || (displayYear === currentYear && displayMonth < currentMonth);
  const isCurrentMonth = displayYear === currentYear && displayMonth === currentMonth;
  const todayDay = today.getDate();

  const pending = expenses.filter((e) => !e.paid);
  const paid = expenses.filter((e) => e.paid);

  return (
    <TxList>
      {pending.map((e) => (
        <FixedExpenseRow key={e.id} expense={e} isCurrentMonth={isCurrentMonth} todayDay={todayDay} isPastMonth={isPastMonth} />
      ))}

      {paid.length > 0 && (
        <>
          <button
            onClick={() => setShowPaid((v) => !v)}
            className="w-full px-4 py-2 flex items-center justify-between text-label uppercase border-t border-border hover:bg-bg-subtle transition-colors bg-bg-subtle text-text-tertiary"
          >
            <span>Pagos · {paid.length}</span>
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform duration-base"
              style={{ transform: showPaid ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
          {showPaid && paid.map((e) => (
            <FixedExpenseRow key={e.id} expense={e} isCurrentMonth={isCurrentMonth} todayDay={todayDay} isPastMonth={isPastMonth} />
          ))}
        </>
      )}
    </TxList>
  );
}
