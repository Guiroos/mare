'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prevMonth, nextMonth, currentYearMonth, formatMonthYear } from '@/lib/utils/date'

export function MonthSelector({
  currentMonth,
  isCurrentMonth,
  isCycleView = false,
  cycleRange,
  availableClosingDays = [],
  activeClosingDay,
}: {
  currentMonth: string
  isCurrentMonth: boolean
  isCycleView?: boolean
  cycleRange?: { start: string; end: string; label: string }
  availableClosingDays?: number[]
  activeClosingDay?: number
}) {
  const router = useRouter()
  const pathname = usePathname()

  const buildUrl = (month: string, opts?: { view?: string; closingDay?: number }) => {
    const params = new URLSearchParams({ month })
    if (opts?.view) params.set('view', opts.view)
    if (opts?.closingDay != null) params.set('closingDay', String(opts.closingDay))
    return `${pathname}?${params.toString()}`
  }

  const navigate = (month: string) =>
    router.push(
      isCycleView && activeClosingDay
        ? buildUrl(month, { view: 'cycle', closingDay: activeClosingDay })
        : buildUrl(month)
    )

  const toggleCycleView = () => {
    const closingDay = activeClosingDay ?? availableClosingDays[0]
    if (isCycleView) {
      router.push(buildUrl(currentMonth))
    } else {
      router.push(buildUrl(currentMonth, { view: 'cycle', closingDay }))
    }
  }

  const hasBillingCycle = availableClosingDays.length > 0

  return (
    <div className="flex flex-col gap-2">
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
          <div className="flex cursor-default flex-col items-center rounded-full border-2 border-border bg-bg-surface px-3.5 py-1.5 shadow-sm">
            <span className="text-body font-semibold text-text-primary">
              {formatMonthYear(currentMonth)}
            </span>
            {isCycleView && cycleRange && (
              <span className="text-caption text-text-tertiary">{cycleRange.label}</span>
            )}
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

        <div className="flex items-center gap-2">
          {/* Billing cycle toggle */}
          {hasBillingCycle && (
            <button
              onClick={toggleCycleView}
              className={
                isCycleView
                  ? 'rounded-full bg-accent px-3 py-1.5 text-caption font-semibold text-text-inverse shadow-sm transition-[background,box-shadow] duration-fast hover:shadow-md active:scale-95'
                  : 'rounded-full border border-border bg-bg-surface px-3 py-1.5 text-caption font-semibold text-text-secondary transition-[background,color] duration-fast hover:bg-bg-subtle active:scale-95'
              }
            >
              Ciclo fatura
            </button>
          )}

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
      </div>
    </div>
  )
}
