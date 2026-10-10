'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

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

  // Gasto fixo está nesta tela; rendimento pendente só se resolve em /investimentos.
  const reviewHref = unpaidFixedCount > 0 ? '#gastos-fixos' : '/investimentos'

  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning-subtle px-3.5 py-2.5 text-small font-medium text-warning-text">
      <AlertCircle className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
      <span className="flex-1">{items.join(' · ')}</span>
      <Link
        href={reviewHref}
        className="shrink-0 font-semibold text-warning-text underline underline-offset-2"
      >
        Revisar
      </Link>
    </div>
  )
}
