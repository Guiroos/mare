'use client';

import { formatCurrency } from '@/lib/format';
import { deleteInvestment } from '@/lib/actions/investments';
import { DeleteButton } from '@/components/ui/delete-button';
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog';

type Investment = {
  id: string;
  amount: string | null;
  yieldAmount: string | null;
  notes: string | null;
  referenceMonth: string;
  investmentTypeId: string;
  investmentType: { name: string };
};

export function InvestmentList({ investments }: { investments: Investment[] }) {
  if (investments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-[13px] font-medium text-text-secondary">
        Nenhum registro de investimento neste mês.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-bg-surface shadow-mare-sm">
      {investments.map((inv) => (
        <div key={inv.id} className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-accent-subtle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>

          {/* Name + notes */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-text-primary truncate">
              {inv.investmentType.name}
            </p>
            {inv.notes && (
              <p className="text-[11px] text-text-tertiary truncate mt-0.5">{inv.notes}</p>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <InvestmentEntryDialog
              investmentTypeId={inv.investmentTypeId}
              existing={{
                id: inv.id,
                amount: inv.amount !== null ? Number(inv.amount) : null,
                yieldAmount: inv.yieldAmount !== null ? Number(inv.yieldAmount) : null,
                notes: inv.notes,
                referenceMonth: inv.referenceMonth,
              }}
            />
            <DeleteButton onDelete={() => deleteInvestment(inv.id)} />
          </div>

          {/* Aporte + Rendimento */}
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
            {inv.amount !== null && (
              <span className="text-[13px] font-semibold tabular-nums text-text-primary" style={{ letterSpacing: '-0.01em' }}>
                + {formatCurrency(Number(inv.amount))}
              </span>
            )}
            {inv.yieldAmount !== null ? (
              <span className="text-[11px] font-semibold tabular-nums text-positive-text">
                Rend. {formatCurrency(Number(inv.yieldAmount))}
              </span>
            ) : inv.amount !== null ? (
              <span className="text-[11px] font-medium text-warning-text">
                Rendimento pendente
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
