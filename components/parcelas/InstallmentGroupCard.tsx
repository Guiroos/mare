'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';
import { InstallmentGroupEditButton } from './InstallmentGroupEditDialog';

type Group = {
  id: string;
  name: string;
  categoryId: string;
  accountId: string;
  accountName: string;
  categoryName: string;
  totalAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  installmentAmount: number;
  remainingAmount: number;
};

export function InstallmentGroupCard({ group }: { group: Group }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="font-semibold leading-tight">{group.name}</p>
          <p className="text-xs text-muted-foreground">{group.accountName}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="muted">
            {group.categoryName}
          </Badge>
          <InstallmentGroupEditButton
            group={{
              id: group.id,
              name: group.name,
              categoryId: group.categoryId,
              accountId: group.accountId,
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Progress
          value={group.paidInstallments}
          max={group.totalInstallments}
          className="h-1.5"
        />
        <p className="text-xs text-muted-foreground">
          Parcela {group.paidInstallments} de {group.totalInstallments}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <div>
          <p className="text-xs text-muted-foreground">por mês</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(group.installmentAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">restante</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(group.remainingAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">total</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatCurrency(group.totalAmount)}
          </p>
        </div>
      </div>
    </div>
  );
}
