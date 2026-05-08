'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/currency'

type Props = {
  data: { name: string; value: number; color?: string }[]
}

const COLORS = [
  'var(--accent)',
  'var(--positive)',
  'var(--warning)',
  'var(--negative)',
  'var(--text-tertiary)',
  'var(--border-strong)',
]

export function InstallmentCategoryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-caption text-text-secondary">
        Nenhum dado.
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="space-y-4">
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-label uppercase text-text-tertiary">Por mês</p>
          <p className="text-h3 tabular-nums">{formatCurrency(total)}</p>
          <p className="text-caption text-text-tertiary">
            {data.length} {data.length === 1 ? 'categoria' : 'categorias'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.map((entry, i) => {
          const color = entry.color ?? COLORS[i % COLORS.length]
          const pct = Math.round((entry.value / total) * 100)
          return (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-caption text-text-secondary">{entry.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-caption tabular-nums text-text-tertiary">{pct}%</span>
                <span className="text-small font-medium tabular-nums">
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
