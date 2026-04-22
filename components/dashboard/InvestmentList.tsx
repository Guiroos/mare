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
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum registro de investimento neste mês.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {investments.map((inv) => (
        <div key={inv.id} className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{inv.investmentType.name}</p>
            {inv.notes && (
              <p className="text-xs text-muted-foreground truncate">{inv.notes}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {inv.amount !== null && (
              <p className="text-sm tabular-nums">
                Aporte: {formatCurrency(Number(inv.amount))}
              </p>
            )}
            {inv.yieldAmount !== null ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                Rend.: {formatCurrency(Number(inv.yieldAmount))}
              </p>
            ) : (
              <p className="text-xs text-yellow-600">Rendimento pendente</p>
            )}
          </div>
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
      ))}
    </div>
  );
}
