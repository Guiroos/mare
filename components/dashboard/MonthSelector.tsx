'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { prevMonth, nextMonth, currentYearMonth, formatMonthYear } from '@/lib/utils/date'

type CreditAccount = { id: string; name: string; closingDay: number }

export function MonthSelector({
  currentMonth,
  isCurrentMonth,
  cycleRange,
  creditAccounts = [],
  activeCycleAccountId,
  action,
}: {
  currentMonth: string
  isCurrentMonth: boolean
  cycleRange?: { start: string; end: string; label: string }
  creditAccounts?: CreditAccount[]
  activeCycleAccountId?: string
  action?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const isCycleView = activeCycleAccountId != null

  const buildUrl = (month: string, cycleAccountId?: string) => {
    const params = new URLSearchParams({ month })
    if (cycleAccountId) params.set('cycleAccount', cycleAccountId)
    return `${pathname}?${params.toString()}`
  }

  const navigate = (month: string) =>
    router.push(buildUrl(month, isCycleView ? activeCycleAccountId : undefined))

  const handleCycleSelect = (value: string) => {
    if (value === 'month') {
      router.push(buildUrl(currentMonth))
    } else {
      router.push(buildUrl(currentMonth, value))
    }
  }

  const hasBillingCycle = creditAccounts.length > 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(prevMonth(currentMonth))}
            aria-label="Mês anterior"
            className="h-7 w-7 rounded-full text-text-tertiary"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex cursor-default flex-col items-center rounded-full border-2 border-border bg-bg-surface px-4 py-1.5 shadow-sm">
            <span className="text-body font-semibold text-text-primary">
              {formatMonthYear(currentMonth)}
            </span>
            {isCycleView && cycleRange && (
              <span className="text-caption text-text-tertiary">{cycleRange.label}</span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(nextMonth(currentMonth))}
            aria-label="Próximo mês"
            className="h-7 w-7 rounded-full text-text-tertiary"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasBillingCycle && (
            <Select value={activeCycleAccountId ?? 'month'} onValueChange={handleCycleSelect}>
              <SelectTrigger
                className={cn(
                  'h-7 w-auto gap-1.5 rounded-full px-3 text-caption font-semibold active:scale-95',
                  isCycleView
                    ? 'border-transparent bg-accent text-text-inverse shadow-sm hover:shadow-md'
                    : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle'
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={6} align="end" className="min-w-40">
                <SelectItem value="month">Mês</SelectItem>
                {creditAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} · dia {account.closingDay}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isCurrentMonth && (
            <Button
              variant="primary"
              size="xs"
              onClick={() => navigate(currentYearMonth())}
              className="rounded-full"
              rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
            >
              Mês atual
            </Button>
          )}
          {action}
        </div>
      </div>
    </div>
  )
}
