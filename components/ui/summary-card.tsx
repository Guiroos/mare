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
  balance: 'before:bg-accent',
  positive: 'before:bg-positive',
  negative: 'before:bg-negative',
}

const amountColor: Record<SummaryVariant, string> = {
  balance: 'text-text-primary',
  positive: 'text-positive',
  negative: 'text-negative',
}

export function SummaryCard({
  variant,
  label,
  amount,
  footer,
  icon,
  className = '',
}: SummaryCardProps) {
  return (
    <div
      className={
        `relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-bg-surface p-5 shadow-sm ` +
        `before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:rounded-t-lg before:content-[''] ` +
        `${accentBar[variant]} ${className}`
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium text-text-secondary">{label}</span>
        {icon && <div className="flex h-8 w-8 items-center justify-center rounded-sm">{icon}</div>}
      </div>
      <div className={`text-amount tabular-nums leading-none ${amountColor[variant]}`}>
        {amount}
      </div>
      {footer && <div className="text-caption text-text-tertiary">{footer}</div>}
    </div>
  )
}
