'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { formatMonthShort, currentYearMonth, currentYear } from '@/lib/utils/date'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'

type OverviewMonth = {
  month: string
  totalIncomes: number
  totalExpenses: number
  balance: number
}

type Props = {
  overview: OverviewMonth[]
  patrimonyTimeline: { month: string; total: number }[]
  year: number
}

const COLOR_INCOME = 'oklch(54% 0.13 172)'
const COLOR_EXPENSE = 'oklch(54% 0.13 20)'
const COLOR_PATRIMONY = 'oklch(50% 0.14 230)'

function ChartLegend({ showProjection }: { showProjection: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-caption text-text-secondary">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: COLOR_INCOME }}
        />
        Receita
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: COLOR_EXPENSE }}
        />
        Despesa
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="20" y2="4" stroke={COLOR_PATRIMONY} strokeWidth="2" />
        </svg>
        Patrimônio
      </span>
      {showProjection && (
        <span className="flex items-center gap-1.5">
          <svg width="20" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="20"
              y2="4"
              stroke={COLOR_PATRIMONY}
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          </svg>
          Projeção
        </span>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-bg-subtle p-3">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-0.5 text-body font-semibold tabular-nums text-text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-caption tabular-nums text-text-tertiary">{sub}</p>}
    </div>
  )
}

export function PatrimonyEvolutionChart({ overview, patrimonyTimeline, year }: Props) {
  const nowYM = currentYearMonth()
  const isCurrentYear = year === currentYear()
  const isPastYear = year < currentYear()

  const timelineMap = new Map(patrimonyTimeline.map((p) => [p.month, p.total]))

  // Find last known patrimony before this year
  let startPatrimony = 0
  for (let i = patrimonyTimeline.length - 1; i >= 0; i--) {
    if (patrimonyTimeline[i].month < `${year}-01`) {
      startPatrimony = patrimonyTimeline[i].total
      break
    }
  }

  // Carry forward last known value for months without a timeline entry
  const resolvedPatrimony: number[] = []
  for (const m of overview) {
    const prev = resolvedPatrimony.at(-1) ?? startPatrimony
    resolvedPatrimony.push(timelineMap.get(m.month) ?? prev)
  }

  const currentMonthIdx = overview.findIndex((m) => m.month === nowYM)

  let avgGrowth = 0
  if (isCurrentYear && currentMonthIdx > 0) {
    avgGrowth = (resolvedPatrimony[currentMonthIdx] - startPatrimony) / currentMonthIdx
  }

  const currentPatrimony =
    currentMonthIdx >= 0 ? resolvedPatrimony[currentMonthIdx] : resolvedPatrimony[11]

  const chartData = overview.map((m, i) => {
    const isFuture = m.month > nowYM
    const isCurrent = m.month === nowYM
    const stepsFromCurrent = currentMonthIdx >= 0 ? i - currentMonthIdx : 0

    return {
      month: formatMonthShort(m.month),
      rawMonth: m.month,
      income: m.totalIncomes,
      expense: m.totalExpenses,
      isFuture,
      isCurrent,
      patrimony: !isFuture ? resolvedPatrimony[i] : undefined,
      // isCurrent serves as visual anchor to connect solid→dashed lines; hidden in tooltip below
      patrimonyProjected:
        isCurrentYear && (isCurrent || isFuture)
          ? currentPatrimony + avgGrowth * stepsFromCurrent
          : undefined,
    }
  })

  const activeMonths = isPastYear ? overview : overview.filter((m) => m.month <= nowYM)

  const bestMonth =
    activeMonths.length > 0
      ? activeMonths.reduce((best, m) => (m.balance > best.balance ? m : best), activeMonths[0])
      : null

  const worstMonth =
    activeMonths.length > 0
      ? activeMonths.reduce((worst, m) => (m.balance < worst.balance ? m : worst), activeMonths[0])
      : null

  const endPatrimony = isPastYear ? resolvedPatrimony[11] : currentPatrimony
  const growthAbs = endPatrimony - startPatrimony
  const growthPct = startPatrimony > 0 ? (growthAbs / startPatrimony) * 100 : null
  const activeCount = isPastYear ? overview.length : currentMonthIdx >= 0 ? currentMonthIdx + 1 : 0

  const projDec = isCurrentYear
    ? (chartData[11]?.patrimonyProjected ?? chartData[11]?.patrimony ?? null)
    : null

  const hasData = activeMonths.some((m) => m.totalIncomes > 0 || m.totalExpenses > 0)

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center text-small text-text-secondary">
        Nenhum dado ainda.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-caption text-text-tertiary">Receita, despesa e patrimônio · {year}</p>
        <h2 className="text-body font-semibold text-text-primary">Evolução financeira do ano</h2>
      </div>

      <ResponsiveContainer width="100%" height={224}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={formatCurrencyShort}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(
              value: number,
              name: string,
              props: { payload?: { isCurrent?: boolean } }
            ) => {
              if (name === 'patrimonyProjected' && props.payload?.isCurrent) return ['', '']
              const labels: Record<string, string> = {
                income: 'Receita',
                expense: 'Despesa',
                patrimony: 'Patrimônio',
                patrimonyProjected: 'Projeção patrimônio',
              }
              return [formatCurrency(value), labels[name] ?? name]
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          />

          {isCurrentYear && (
            <ReferenceLine
              x={formatMonthShort(nowYM)}
              stroke="var(--text-tertiary)"
              strokeDasharray="3 3"
              label={{
                value: 'HOJE',
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--text-secondary)',
              }}
            />
          )}

          <Bar dataKey="income" name="income" maxBarSize={32} radius={[2, 2, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={COLOR_INCOME} fillOpacity={d.isFuture ? 0.2 : 1} />
            ))}
          </Bar>

          <Bar dataKey="expense" name="expense" maxBarSize={32} radius={[2, 2, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={COLOR_EXPENSE} fillOpacity={d.isFuture ? 0.2 : 1} />
            ))}
          </Bar>

          <Line
            dataKey="patrimony"
            name="patrimony"
            stroke={COLOR_PATRIMONY}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />

          <Line
            dataKey="patrimonyProjected"
            name="patrimonyProjected"
            stroke={COLOR_PATRIMONY}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ChartLegend showProjection={isCurrentYear} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {bestMonth && (
          <StatCard
            label="Melhor mês (sobra)"
            value={formatCurrency(bestMonth.balance)}
            sub={formatMonthShort(bestMonth.month).toUpperCase()}
          />
        )}
        {worstMonth && (
          <StatCard
            label="Pior mês (sobra)"
            value={formatCurrency(worstMonth.balance)}
            sub={formatMonthShort(worstMonth.month).toUpperCase()}
          />
        )}
        {activeCount > 0 && (
          <StatCard
            label="Crescimento patrimônio"
            value={`${growthAbs >= 0 ? '+' : ''}${formatCurrency(growthAbs)}`}
            sub={
              growthPct !== null
                ? `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}% em ${activeCount} ${activeCount === 1 ? 'mês' : 'meses'}`
                : `em ${activeCount} ${activeCount === 1 ? 'mês' : 'meses'}`
            }
          />
        )}
        {projDec !== null && (
          <StatCard
            label={`Projeção dez/${year}`}
            value={formatCurrencyShort(projDec)}
            sub="patrimônio estimado"
          />
        )}
      </div>
    </div>
  )
}
