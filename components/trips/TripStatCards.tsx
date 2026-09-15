import type { ReactNode } from 'react'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { cn } from '@/lib/utils/cn'

type StatCardProps = {
  label: string
  value: number
  accentClass: string
  hint?: ReactNode
}

function StatCard({ label, value, accentClass, hint }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-bg-surface p-5 shadow-sm',
        'before:absolute before:inset-x-0 before:top-0 before:h-1',
        accentClass
      )}
    >
      <p className="text-caption font-medium text-text-secondary">{label}</p>
      <p className="mt-2 text-amount tabular-nums">
        <SensitiveAmount value={value} />
      </p>
      {hint && <p className="mt-1 text-caption tabular-nums text-text-secondary">{hint}</p>}
    </div>
  )
}

export function TripStatCards({
  totalSpent,
  totalIncome,
  totalWithdrawn,
  withdrawnTax,
  goalSaved,
  goalBalance,
}: {
  totalSpent: number
  totalIncome: number
  totalWithdrawn: number
  withdrawnTax: number
  goalSaved: number | null
  goalBalance: number | null
}) {
  const hasWithdrawals = totalWithdrawn > 0
  // Sem resgate da caixinha, "guardado para a viagem" e "ainda na caixinha" são o mesmo número
  const showRemaining =
    goalSaved !== null &&
    goalBalance !== null &&
    Math.round(goalSaved * 100) !== Math.round(goalBalance * 100)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Total gasto" value={totalSpent} accentClass="before:bg-negative" />
      {goalSaved !== null && (
        <StatCard label="Guardado para a viagem" value={goalSaved} accentClass="before:bg-accent" />
      )}
      {hasWithdrawals && (
        <StatCard
          label="Resgatado"
          value={totalWithdrawn}
          accentClass="before:bg-positive"
          hint={
            withdrawnTax > 0 ? (
              <>
                IR/IOF: <SensitiveAmount value={withdrawnTax} />
              </>
            ) : undefined
          }
        />
      )}
      {showRemaining && (
        <StatCard label="Ainda na caixinha" value={goalBalance} accentClass="before:bg-accent" />
      )}
      {totalIncome > 0 && (
        <StatCard
          label={hasWithdrawals ? 'Outras entradas' : 'Total em entradas'}
          value={totalIncome}
          accentClass="before:bg-positive"
        />
      )}
    </div>
  )
}
