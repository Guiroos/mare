'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import * as RadixSelect from '@radix-ui/react-select'
import { prevMonth, nextMonth, currentYearMonth, formatMonthYear } from '@/lib/utils/date'

type CreditAccount = { id: string; name: string; closingDay: number }

export function MonthSelector({
  currentMonth,
  isCurrentMonth,
  cycleRange,
  creditAccounts = [],
  activeCycleAccountId,
}: {
  currentMonth: string
  isCurrentMonth: boolean
  cycleRange?: { start: string; end: string; label: string }
  creditAccounts?: CreditAccount[]
  activeCycleAccountId?: string
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
          <button
            onClick={() => navigate(prevMonth(currentMonth))}
            aria-label="Mês anterior"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex cursor-default flex-col items-center rounded-full border-2 border-border bg-bg-surface px-3.5 py-1.5 shadow-sm">
            <span className="text-body font-semibold text-text-primary">
              {formatMonthYear(currentMonth)}
            </span>
            {isCycleView && cycleRange && (
              <span className="text-caption text-text-tertiary">{cycleRange.label}</span>
            )}
          </div>

          <button
            onClick={() => navigate(nextMonth(currentMonth))}
            aria-label="Próximo mês"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {hasBillingCycle && (
            <RadixSelect.Root
              value={activeCycleAccountId ?? 'month'}
              onValueChange={handleCycleSelect}
            >
              <RadixSelect.Trigger
                className={[
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold outline-none',
                  'transition-all duration-fast active:scale-95',
                  isCycleView
                    ? 'bg-accent text-text-inverse shadow-sm hover:shadow-md'
                    : 'border border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle',
                ].join(' ')}
              >
                <RadixSelect.Value>
                  {isCycleView
                    ? (creditAccounts.find((a) => a.id === activeCycleAccountId)?.name ?? 'Ciclo')
                    : 'Mês'}
                </RadixSelect.Value>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </RadixSelect.Trigger>

              <RadixSelect.Portal>
                <RadixSelect.Content
                  position="popper"
                  sideOffset={6}
                  align="end"
                  className="z-50 min-w-40 overflow-hidden rounded-md border border-border bg-bg-surface shadow-md"
                >
                  <RadixSelect.Viewport className="p-1">
                    <RadixSelect.Item
                      value="month"
                      className="flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-small text-text-primary outline-none data-[highlighted]:bg-bg-subtle"
                    >
                      <RadixSelect.ItemText>Mês</RadixSelect.ItemText>
                    </RadixSelect.Item>

                    {creditAccounts.map((account) => (
                      <RadixSelect.Item
                        key={account.id}
                        value={account.id}
                        className="flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-small text-text-primary outline-none data-[highlighted]:bg-bg-subtle"
                      >
                        <RadixSelect.ItemText>
                          {account.name} · dia {account.closingDay}
                        </RadixSelect.ItemText>
                      </RadixSelect.Item>
                    ))}
                  </RadixSelect.Viewport>
                </RadixSelect.Content>
              </RadixSelect.Portal>
            </RadixSelect.Root>
          )}

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
