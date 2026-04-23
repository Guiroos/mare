import { ReactNode } from 'react'

type SummaryVariant = 'balance' | 'positive' | 'negative'

interface SummaryCardProps {
  variant: SummaryVariant
  label: string
  amount: string
  footer?: string
  icon?: ReactNode
  className?: string
}

const accentBar: Record<SummaryVariant, string> = {
  balance:  'before:bg-accent',
  positive: 'before:bg-positive',
  negative: 'before:bg-negative',
}

const amountColor: Record<SummaryVariant, string> = {
  balance:  'text-text-primary',
  positive: 'text-positive',
  negative: 'text-negative',
}

export function SummaryCard({ variant, label, amount, footer, icon, className = '' }: SummaryCardProps) {
  return (
    <div
      className={
        `relative overflow-hidden bg-bg-surface border border-border rounded-lg shadow-sm p-5 flex flex-col gap-3 ` +
        `before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:rounded-t-lg ` +
        `${accentBar[variant]} ${className}`
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium text-text-secondary">{label}</span>
        {icon && <div className="w-8 h-8 rounded-sm flex items-center justify-center">{icon}</div>}
      </div>
      <div className={`text-amount tabular-nums leading-none ${amountColor[variant]}`}>
        {amount}
      </div>
      {footer && <div className="text-caption text-text-tertiary">{footer}</div>}
    </div>
  )
}
