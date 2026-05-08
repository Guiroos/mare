'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatMonthShort } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'

type Props = {
  data: { month: string; total: number; groups: { name: string; amount: number }[] }[]
  currentYM: string
}

function formatCurrencyShort(value: number) {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`
  return `R$${value.toFixed(0)}`
}

export function InstallmentTimelineChart({ data, currentYM }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-caption text-text-secondary">
        Nenhum compromisso futuro.
      </div>
    )
  }

  const chartData = data.map((d) => ({
    month: d.month,
    label: formatMonthShort(d.month),
    total: d.total,
    _groups: d.groups,
    isCurrent: d.month === currentYM,
  }))

  const peak = chartData.reduce((a, b) => (a.total >= b.total ? a : b))
  const last = chartData[chartData.length - 1]

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const entry = payload[0]?.payload as (typeof chartData)[0]
                return (
                  <div className="rounded-lg border bg-bg-surface px-3 py-2 text-caption shadow-md">
                    <p className="mb-1 font-medium">{label}</p>
                    {entry._groups.map((g) => (
                      <p key={g.name} className="tabular-nums text-text-secondary">
                        {g.name}: {formatCurrency(g.amount)}
                      </p>
                    ))}
                    <p className="mt-1 border-t pt-1 font-semibold tabular-nums">
                      Total: {formatCurrency(entry.total)}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={entry.isCurrent ? 'var(--accent)' : 'var(--bg-muted)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-caption text-text-tertiary">
        <span>
          Pico:{' '}
          <strong className="tabular-nums text-text-primary">
            {peak.label} · {formatCurrency(peak.total)}
          </strong>
        </span>
        <span>
          Última cobrança:{' '}
          <strong className="text-text-primary">{formatMonthShort(last.month)}</strong>
        </span>
      </div>
    </div>
  )
}
