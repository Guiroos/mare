'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Props = {
  data: { month: string; groups: { groupId: string; groupName: string; total: number }[] }[]
  allGroupNames: string[]
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

import { formatMonthShort } from '@/lib/utils/date'

function formatCurrencyShort(value: number) {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`
  return `R$${value.toFixed(0)}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function AnnualStackedChart({ data, allGroupNames }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-text-secondary">
        Nenhum dado ainda.
      </div>
    )
  }

  const chartData = data.map((d) => {
    const row: Record<string, string | number> = { month: formatMonthShort(d.month) }
    for (const groupName of allGroupNames) {
      const match = d.groups.find((g) => g.groupName === groupName)
      row[groupName] = match ? match.total : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={formatCurrencyShort}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => `Mês: ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {allGroupNames.map((groupName, index) => (
          <Bar
            key={groupName}
            dataKey={groupName}
            stackId="a"
            fill={COLORS[index % COLORS.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
