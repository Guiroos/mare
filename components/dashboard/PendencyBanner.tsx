'use client'

interface Props {
  unpaidFixedCount: number
  pendingYieldCount: number
}

export function PendencyBanner({ unpaidFixedCount, pendingYieldCount }: Props) {
  const items: string[] = []

  if (unpaidFixedCount > 0) {
    items.push(
      unpaidFixedCount === 1
        ? '1 gasto fixo não pago'
        : `${unpaidFixedCount} gastos fixos não pagos`
    )
  }

  if (pendingYieldCount > 0) {
    items.push(
      pendingYieldCount === 1
        ? '1 rendimento de investimento pendente'
        : `${pendingYieldCount} rendimentos de investimento pendentes`
    )
  }

  if (items.length === 0) return null

  return (
    <div className="flex items-start gap-2 rounded-[12px] border border-warning bg-warning-subtle px-3.5 py-2.5 text-[13px] font-medium text-warning-text">
      <svg
        className="mt-[1px] shrink-0 text-warning"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{items.length === 1 ? items[0] : items.join(' · ')}</span>
    </div>
  )
}
