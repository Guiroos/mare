'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { deleteTransaction } from '@/lib/actions/transactions';
import { DeleteButton } from '@/components/ui/delete-button';
import { TransactionEditButton } from './TransactionEditDialog';

const INITIAL_LIMIT = 5;

type Transaction = {
  id: string;
  name: string;
  amount: string;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  category: { name: string; color: string | null; bgColor: string | null } | null;
  account: { name: string } | null;
  installmentGroup: { id: string } | null;
};

function getInitial(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const col = t.category ?? null;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[13px] font-semibold flex-shrink-0 bg-bg-subtle text-text-secondary"
        style={col?.bgColor || col?.color ? {
          background: col.bgColor ?? undefined,
          color: col.color ?? undefined,
        } : undefined}
      >
        {getInitial(t.name)}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-text-primary truncate">{t.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {col && (
            <>
              <span
                className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                style={{ background: col.color ?? undefined }}
              />
              <span className="text-[11px] font-medium text-text-secondary">
                {col.name}
              </span>
            </>
          )}
          {t.account && (
            <>
              <span className="text-[11px] text-text-tertiary">·</span>
              <span className="text-[11px] text-text-tertiary">{t.account.name}</span>
            </>
          )}
          {t.installmentNumber && t.totalInstallments && (
            <span className="ml-1 text-[10px] font-semibold px-1.5 py-[1px] rounded bg-bg-subtle border border-border text-text-tertiary">
              {t.installmentNumber}/{t.totalInstallments}
            </span>
          )}
        </div>
      </div>

      {!t.installmentGroup && (
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <TransactionEditButton transaction={t} />
          <DeleteButton onDelete={() => deleteTransaction(t.id)} />
        </div>
      )}

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span
          className="text-[14px] font-semibold tabular-nums text-negative-text"
          style={{ letterSpacing: '-0.01em' }}
        >
          − {formatCurrency(Number(t.amount))}
        </span>
        <span className="text-[11px] text-text-tertiary tabular-nums">
          {formatDate(t.date)}
        </span>
      </div>
    </div>
  );
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [showAll, setShowAll] = useState(false);

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-11 h-11 rounded-[12px] bg-bg-subtle flex items-center justify-center">
          <svg className="w-5 h-5 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <p className="text-[13px] font-medium text-text-secondary">
          Nenhuma transação registrada neste mês.
        </p>
      </div>
    );
  }

  const standalone = transactions.filter((t) => !t.installmentGroup);
  const installments = transactions.filter((t) => t.installmentGroup);

  const visibleStandalone = showAll ? standalone : standalone.slice(0, INITIAL_LIMIT);
  const hiddenCount = standalone.length - visibleStandalone.length + installments.length;

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-bg-surface shadow-mare-sm">
      {visibleStandalone.map((t) => (
        <TransactionRow key={t.id} transaction={t} />
      ))}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-4 py-2.5 text-[13px] font-medium text-accent-text bg-accent-subtle hover:opacity-90 transition-opacity"
        >
          Ver mais {hiddenCount} {hiddenCount === 1 ? 'transação' : 'transações'}
        </button>
      )}

      {showAll && installments.length > 0 && (
        <>
          <div className="px-4 py-1.5 bg-bg-subtle border-y border-border text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">
            Parcelas
          </div>
          {installments.map((t) => (
            <TransactionRow key={t.id} transaction={t} />
          ))}
        </>
      )}
    </div>
  );
}
