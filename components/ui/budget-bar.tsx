import { ReactNode } from 'react'
import { formatCurrency as defaultFormat } from '@/lib/format'

type BudgetTone = 'ok' | 'warn' | 'over' | 'accent'

interface BudgetBarProps {
  current: number
  target: number
  label?: ReactNode
  tone?: BudgetTone
  hint?: ReactNode
  formatValue?: (v: number) => string
  className?: string
}

const toneBg: Record<BudgetTone, string> = {
  ok:     'bg-positive',
  warn:   'bg-warning',
  over:   'bg-negative',
  accent: 'bg-accent',
}

export function BudgetBar({ current, target, label, tone, hint, formatValue = defaultFormat, className = '' }: BudgetBarProps) {
  const pct = target > 0 ? (current / target) * 100 : 0
  const t: BudgetTone = tone ?? (pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok')

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-small font-medium text-text-primary">{label}</span>
        <span className="text-caption text-text-secondary tabular-nums">
          {formatValue(current)} / {formatValue(target)}{hint && <> · {hint}</>}
        </span>
      </div>
      <div className="h-1.5 bg-bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${toneBg[t]}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}
