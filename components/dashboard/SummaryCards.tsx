import { formatCurrency } from '@/lib/format';

type Summary = {
  totalIncomes: number;
  totalExpenses: number;
  totalInvested: number;
  balance: number;
  totalBudget: number;
  totalSpent: number;
};

export function SummaryCards({ summary }: { summary: Summary }) {
  const { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent } = summary;
  const budgetPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const budgetOver = totalSpent > totalBudget && totalBudget > 0;

  return (
    <div
      className="rounded-[20px] p-6 relative overflow-hidden text-white"
      style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, oklch(44% 0.13 218) 100%)',
      }}
    >
      {/* Watermark waves */}
      <svg
        className="absolute right-[-24px] bottom-[-24px] w-40 h-24 opacity-10 pointer-events-none"
        viewBox="0 0 160 100"
        fill="none"
        aria-hidden
      >
        <path d="M0 50 C30 20,60 20,80 45 C100 70,130 70,160 45 L160 100 L0 100 Z" fill="white" />
        <path d="M0 70 C30 45,60 45,80 62 C100 80,130 80,160 62 L160 100 L0 100 Z" fill="white" />
      </svg>

      {/* Label */}
      <p className="text-[12px] font-medium uppercase tracking-[0.04em] opacity-70">
        Saldo do Mês
      </p>

      {/* Balance amount */}
      <p
        className="text-[40px] font-semibold leading-[1.1] mt-1.5 mb-5 tabular-nums"
        style={{ letterSpacing: '-0.04em' }}
      >
        {formatCurrency(balance)}
      </p>

      {/* Incomes / Expenses / Invested */}
      <div
        className="flex gap-8 pt-4"
        style={{ borderTop: '1px solid oklch(100% 0 0 / 0.15)' }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-60">
            Entradas
          </span>
          <span className="text-[16px] font-semibold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            + {formatCurrency(totalIncomes)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-60">
            Gastos
          </span>
          <span className="text-[16px] font-semibold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            − {formatCurrency(totalExpenses)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 ml-auto items-end">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-60">
            Investido
          </span>
          <span className="text-[14px] font-semibold tabular-nums opacity-85" style={{ letterSpacing: '-0.02em' }}>
            {formatCurrency(totalInvested)}
          </span>
        </div>
      </div>

      {/* Budget progress bar */}
      {totalBudget > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] opacity-65">
              Orçamento utilizado
            </span>
            <span className="text-[12px] font-semibold opacity-90 tabular-nums">
              {Math.round(budgetPct)}%{' '}
              <span className="opacity-70 font-normal">
                · {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
              </span>
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'oklch(100% 0 0 / 0.2)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${budgetPct}%`,
                background: budgetOver
                  ? 'oklch(75% 0.15 30 / 0.9)'
                  : 'oklch(100% 0 0 / 0.75)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
