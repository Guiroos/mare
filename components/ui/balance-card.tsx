interface BalanceCardProps {
  label: string
  amount: string
  income?: string
  expense?: string
  className?: string
}

export function BalanceCard({ label, amount, income, expense, className = '' }: BalanceCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-accent p-6 text-text-inverse ${className}`}
    >
      <div className="text-small font-medium opacity-70">{label}</div>
      <div className="mb-4 mt-1 text-hero tabular-nums">{amount}</div>
      {(income || expense) && (
        <div className="mt-4 flex gap-6 border-t border-white/15 pt-4">
          {income && (
            <div className="flex flex-col gap-0.5">
              <span className="text-label opacity-60">ENTRADAS</span>
              <span className="text-body-lg font-semibold tabular-nums tracking-tight">
                + {income}
              </span>
            </div>
          )}
          {expense && (
            <div className="flex flex-col gap-0.5">
              <span className="text-label opacity-60">SAÍDAS</span>
              <span className="text-body-lg font-semibold tabular-nums tracking-tight">
                − {expense}
              </span>
            </div>
          )}
        </div>
      )}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className="pointer-events-none absolute -bottom-5 -right-5 h-24 w-24 opacity-10"
        aria-hidden
      >
        <path
          d="M10 60 C30 30, 50 20, 70 50 C90 80, 100 60, 110 40"
          stroke="white"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M10 80 C30 55, 55 45, 75 65 C95 85, 105 75, 115 60"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
