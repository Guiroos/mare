'use client';

import { AlertCircle } from 'lucide-react';

interface Props {
  unpaidFixedCount: number;
  pendingYieldCount: number;
}

export function PendencyBanner({ unpaidFixedCount, pendingYieldCount }: Props) {
  const items: string[] = [];

  if (unpaidFixedCount > 0) {
    items.push(
      unpaidFixedCount === 1
        ? '1 gasto fixo não pago'
        : `${unpaidFixedCount} gastos fixos não pagos`
    );
  }

  if (pendingYieldCount > 0) {
    items.push(
      pendingYieldCount === 1
        ? '1 rendimento de investimento pendente'
        : `${pendingYieldCount} rendimentos de investimento pendentes`
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>
        {items.length === 1 ? items[0] : items.join(' · ')}
      </span>
    </div>
  );
}
