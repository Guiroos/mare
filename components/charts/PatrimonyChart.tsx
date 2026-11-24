'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatMonthShort } from '@/lib/utils/date'
import { formatAxisCurrency, formatCurrency } from '@/lib/utils/currency'

type DataPoint = { month: string; total: number; aporte?: number }

export function PatrimonyChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-small text-text-secondary">
        Nenhum dado ainda.
      </div>
    )
  }

  const hasAporte = data.some((d) => d.aporte !== undefined)
  const chartData = data.map((d) => ({
    month: formatMonthShort(d.month),
    total: d.total,
    ...(hasAporte ? { aporte: d.aporte } : {}),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="patrimonyAreaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === '__fill__') return ['', '']
            return [
              formatCurrency(value),
              name === 'total' ? 'Patrimônio total' : 'Capital alocado',
            ]
          }}
          labelFormatter={(label) => `Mês: ${label}`}
        />
        {hasAporte && (
          <Line
            type="monotone"
            dataKey="aporte"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 3 }}
            className="stroke-text-tertiary"
          />
        )}
        <Area
          type="monotone"
          dataKey="total"
          name="__fill__"
          stroke="none"
          fill="url(#patrimonyAreaFill)"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="total"
          strokeWidth={2.2}
          dot={false}
          activeDot={{ r: 4 }}
          className="stroke-accent"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
