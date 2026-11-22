'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatAxisCurrency, formatCurrency } from '@/lib/utils/currency'
import { BalanceEvolutionPoint } from '@/lib/queries/debtors'

type Props = {
  data: BalanceEvolutionPoint[]
}

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export function DebtBalanceEvolutionChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border bg-bg-surface">
        <p className="text-small text-text-tertiary">Dados insuficientes para exibir o gráfico.</p>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    Saldo: d.balance,
  }))

  return (
    <div className="rounded-xl border bg-bg-surface p-4">
      <ResponsiveContainer width="100%" height={224}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={formatAxisCurrency}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Saldo']}
            contentStyle={{
              borderRadius: '10px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface)',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="Saldo"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
