import { formatCurrency } from '@/lib/utils/currency'

type Summary = {
  totalIncomes: number
  totalExpenses: number
  totalInvested: number
  balance: number
  totalBudget: number
  totalSpent: number
}

export function SummaryCards({ summary }: { summary: Summary }) {
  const { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent } = summary
  const budgetPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const budgetOver = totalSpent > totalBudget && totalBudget > 0

  return (
    <div
      className="relative overflow-hidden rounded-xl p-6 text-text-inverse"
      style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, oklch(44% 0.13 218) 100%)',
      }}
    >
      {/* Watermark waves */}
      <svg
        className="pointer-events-none absolute bottom-[-24px] right-[-24px] h-24 w-40 opacity-10"
        viewBox="0 0 160 100"
        fill="none"
        aria-hidden
      >
        <path d="M0 50 C30 20,60 20,80 45 C100 70,130 70,160 45 L160 100 L0 100 Z" fill="white" />
        <path d="M0 70 C30 45,60 45,80 62 C100 80,130 80,160 62 L160 100 L0 100 Z" fill="white" />
      </svg>

      {/* Label */}
      <p className="text-label uppercase opacity-70">Saldo do Mês</p>

      {/* Balance amount */}
      <p className="mb-5 mt-1.5 text-hero tabular-nums">{formatCurrency(balance)}</p>

      {/* Incomes / Expenses / Invested */}
      <div className="flex flex-wrap gap-x-8 gap-y-0 border-t border-white/15 pt-4 lg:flex-nowrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-label uppercase opacity-60">Entradas</span>
          <span className="text-body-lg font-semibold tabular-nums tracking-tight">
            + {formatCurrency(totalIncomes)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-label uppercase opacity-60">Gastos</span>
          <span className="text-body-lg font-semibold tabular-nums tracking-tight">
            − {formatCurrency(totalExpenses)}
          </span>
        </div>
        <div className="mt-3 flex w-full items-center justify-between border-t border-white/10 pt-3 lg:ml-auto lg:mt-0 lg:w-auto lg:flex-col lg:items-end lg:justify-start lg:border-0 lg:pt-0">
          <span className="text-label uppercase opacity-60">Investido</span>
          <span className="text-body font-semibold tabular-nums tracking-tight opacity-85">
            {formatCurrency(totalInvested)}
          </span>
        </div>
      </div>

      {/* Budget progress bar */}
      {totalBudget > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <span className="text-label uppercase opacity-65">Orçamento utilizado</span>
            <div className="flex-shrink-0 text-right">
              <span className="text-caption font-semibold tabular-nums opacity-90">
                {Math.round(budgetPct)}%
              </span>
              <span className="block text-caption tabular-nums opacity-70 lg:inline">
                {' '}
                · {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
              </span>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/20">
            <div
              className={`h-full rounded-full transition-all duration-500 ${budgetOver ? 'bg-negative/80' : 'bg-white/75'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
