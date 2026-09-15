import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { cn } from '@/lib/utils/cn'

type StatCardProps = {
  label: string
  value: number
  accentClass: string
}

function StatCard({ label, value, accentClass }: StatCardProps) {
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
    </div>
  )
}

export function TripStatCards({
  totalSpent,
  totalIncome,
  goalBalance,
}: {
  totalSpent: number
  totalIncome: number
  goalBalance: number | null
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Total gasto" value={totalSpent} accentClass="before:bg-negative" />
      {totalIncome > 0 && (
        <StatCard label="Total em entradas" value={totalIncome} accentClass="before:bg-positive" />
      )}
      {goalBalance !== null && (
        <StatCard label="Guardado na caixinha" value={goalBalance} accentClass="before:bg-accent" />
      )}
    </div>
  )
}
