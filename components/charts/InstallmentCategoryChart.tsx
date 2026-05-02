'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/currency'

type Props = {
  data: { name: string; value: number; color?: string }[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export function InstallmentCategoryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-secondary">
        Nenhum dado.
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [formatCurrency(value), 'Por mês']} />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2">
        {data.map((entry, i) => {
          const color = entry.color ?? COLORS[i % COLORS.length]
          const pct = Math.round((entry.value / total) * 100)
          return (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-sm text-text-secondary">{entry.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-text-tertiary">{pct}%</span>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(entry.value)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
