import { ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { currentYearMonth } from '@/lib/utils/date'
import { OverviewMonth } from '@/lib/queries/panorama'

interface Props {
  overview: OverviewMonth[]
  prevOverview: OverviewMonth[]
  year: number
  totalIncomes: number
  totalInvested: number
}

interface MetricCardProps {
  label: string
  value: number
  pct: number | null
  variant: 'positive' | 'negative' | 'warning'
  accentClass: string
  year: number
  footer: string
}

function MetricCard({ label, value, pct, variant, accentClass, year, footer }: MetricCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-bg-surface p-5 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-px',
        accentClass
      )}
    >
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-2 text-amount tabular-nums">{formatCurrency(value)}</p>
      {pct !== null && (
        <div className="mt-3 flex items-center gap-2">
          <Badge variant={variant} size="sm" className="tabular-nums">
            <ChevronUp className={cn('h-3 w-3', pct < 0 && 'rotate-180')} strokeWidth={3} />
            {Math.abs(Math.round(pct))}%
          </Badge>
          <span className="text-caption text-text-tertiary">vs. {year - 1}</span>
        </div>
      )}
      <p className="mt-3 text-caption text-text-tertiary">{footer}</p>
    </div>
  )
}

function changePct(curr: number, prev: number, usePrevAbs = false): number | null {
  if (prev === 0) return null
  return ((curr - prev) / (usePrevAbs ? Math.abs(prev) : prev)) * 100
}

export function AnnualSummaryCards({
  overview,
  prevOverview,
  year,
  totalIncomes,
  totalInvested,
}: Props) {
  // Meses já ocorridos: determina por data, não por presença de receita.
  // Filtrar por totalIncomes > 0 quebra quando não há receitas no ano (só parcelas).
  const nowYearMonth = currentYearMonth()
  const active = overview.filter((m) => m.month <= nowYearMonth)
  const monthsElapsed = active.length
  const activeMonthKeys = new Set(active.map((m) => m.month.slice(5)))

  const totalExpensesYTD = active.reduce((s, m) => s + m.totalExpenses, 0)

  const balance = totalIncomes - totalExpensesYTD

  const prevSamePeriod = prevOverview.filter((m) => activeMonthKeys.has(m.month.slice(5)))
  const prevIncomes = prevSamePeriod.reduce((s, m) => s + m.totalIncomes, 0)
  const prevExpenses = prevSamePeriod.reduce((s, m) => s + m.totalExpenses, 0)
  const prevInvested = prevSamePeriod.reduce((s, m) => s + m.totalInvested, 0)
  const prevBalance = prevIncomes - prevExpenses

  const avgExpense = monthsElapsed > 0 ? totalExpensesYTD / monthsElapsed : 0
  const projectedIncome = monthsElapsed > 0 ? (totalIncomes / monthsElapsed) * 12 : 0
  const taxaPoupanca = totalIncomes > 0 ? Math.round((balance / totalIncomes) * 100) : 0
  const taxaInvestimento = totalIncomes > 0 ? Math.round((totalInvested / totalIncomes) * 100) : 0
  const monthsWithInvestment = overview.filter((m) => m.totalInvested > 0).length

  const incomeChangePct = changePct(totalIncomes, prevIncomes)
  const expenseChangePct = changePct(totalExpensesYTD, prevExpenses)
  const balanceChangePct = changePct(balance, prevBalance, true)
  const investedChangePct = changePct(totalInvested, prevInvested)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        className="relative overflow-hidden rounded-xl shadow-md"
        style={{
          background:
            'linear-gradient(135deg, oklch(20% 0.04 230) 0%, oklch(28% 0.07 220) 50%, oklch(50% 0.14 230) 110%)',
          color: 'white',
        }}
      >
        <svg
          className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-10"
          width="100%"
          height="64"
          viewBox="0 0 400 64"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 40 C60 20, 120 35, 200 25 C280 15, 340 30, 400 18"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M0 55 C70 40, 130 50, 200 42 C270 34, 340 48, 400 38"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity=".5"
          />
        </svg>
        <div className="relative p-5">
          <p className="text-label opacity-70">Saldo do Ano</p>
          <p className="mt-2 text-hero tabular-nums">{formatCurrency(balance)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {balanceChangePct !== null && (
              <span
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-label font-semibold tabular-nums"
                style={{ background: 'oklch(100% 0 0 / 0.16)' }}
              >
                <ChevronUp
                  className={cn('h-3 w-3', balanceChangePct < 0 && 'rotate-180')}
                  strokeWidth={3}
                />
                {Math.abs(Math.round(balanceChangePct))}% vs. {year - 1}
              </span>
            )}
            <span className="text-label tabular-nums opacity-70">{taxaPoupanca}% poupado</span>
          </div>
        </div>
      </div>

      <MetricCard
        label="Receita Acumulada"
        value={totalIncomes}
        pct={incomeChangePct}
        variant={incomeChangePct !== null && incomeChangePct >= 0 ? 'positive' : 'negative'}
        accentClass="before:bg-positive"
        year={year}
        footer={
          monthsElapsed > 0
            ? `proj. ${formatCurrencyShort(projectedIncome)} · média ${formatCurrencyShort(totalIncomes / monthsElapsed)}/mês`
            : 'sem dados ainda'
        }
      />

      <MetricCard
        label="Despesa Acumulada"
        value={totalExpensesYTD}
        pct={expenseChangePct}
        variant={expenseChangePct !== null && expenseChangePct > 0 ? 'warning' : 'positive'}
        accentClass="before:bg-negative"
        year={year}
        footer={
          monthsElapsed > 0
            ? `proj. ${formatCurrencyShort(avgExpense * 12)} · média ${formatCurrencyShort(avgExpense)}/mês`
            : 'sem dados ainda'
        }
      />

      <MetricCard
        label="Investimentos"
        value={totalInvested}
        pct={investedChangePct}
        variant={investedChangePct !== null && investedChangePct >= 0 ? 'positive' : 'negative'}
        accentClass="before:bg-accent"
        year={year}
        footer={
          monthsWithInvestment > 0
            ? `média/mês ${formatCurrencyShort(totalInvested / monthsWithInvestment)} · ${taxaInvestimento}% da receita`
            : 'sem aportes registrados'
        }
      />
    </div>
  )
}
