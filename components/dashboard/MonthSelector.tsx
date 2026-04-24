'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prevMonth, nextMonth, currentYearMonth, formatMonthYear } from '@/lib/utils/date'

export function MonthSelector({
  currentMonth,
  isCurrentMonth,
}: {
  currentMonth: string
  isCurrentMonth: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (month: string) => router.push(`${pathname}?month=${month}`)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => navigate(prevMonth(currentMonth))}
          aria-label="Mês anterior"
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Pill */}
        <div className="flex cursor-default items-center rounded-full border-2 border-border bg-bg-surface px-3.5 py-1.5 shadow-sm">
          <span className="text-body font-semibold text-text-primary">
            {formatMonthYear(currentMonth)}
          </span>
        </div>

        {/* Next */}
        <button
          onClick={() => navigate(nextMonth(currentMonth))}
          disabled={isCurrentMonth}
          aria-label="Próximo mês"
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Jump to current month */}
      {!isCurrentMonth && (
        <button
          onClick={() => navigate(currentYearMonth())}
          className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-caption font-semibold text-text-inverse shadow-sm transition-all hover:shadow-md active:scale-95"
        >
          Mês atual
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
