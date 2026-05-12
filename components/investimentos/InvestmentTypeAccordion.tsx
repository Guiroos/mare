'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatMonthName, referenceMonthToYearMonth } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { InvestmentTypeDialog } from '@/components/investimentos/InvestmentTypeDialog'
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteInvestmentType } from '@/lib/actions/investments'

const PALETTE = [
  { bg: 'oklch(94% 0.04 170)', fg: 'oklch(34% 0.11 170)' },
  { bg: 'oklch(94% 0.04 200)', fg: 'oklch(34% 0.11 200)' },
  { bg: 'oklch(95% 0.04 70)', fg: 'oklch(38% 0.12 60)' },
  { bg: 'oklch(94% 0.05 290)', fg: 'oklch(34% 0.14 290)' },
  { bg: 'oklch(94% 0.04 20)', fg: 'oklch(38% 0.12 22)' },
  { bg: 'oklch(94% 0.04 225)', fg: 'oklch(38% 0.12 230)' },
]

function typeInitials(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

type Entry = {
  id: string
  referenceMonth: string
  amount: number | null
  yieldAmount: number | null
  notes: string | null
  excludeFromCashFlow: boolean
}

type Balance = {
  id: string
  name: string
  totalAmount: number
  totalYield: number
  totalWithdrawn: number
  currentBalance: number
  pendingYield: boolean
  entries: Entry[]
}

type Props = {
  balances: Balance[]
  totalPatrimony: number
}

export function InvestmentTypeAccordion({ balances, totalPatrimony }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(balances.length > 0 ? [balances[0].id] : [])
  )

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {balances.map((balance, i) => {
        const isOpen = expanded.has(balance.id)
        const color = PALETTE[i % PALETTE.length]
        const initials = typeInitials(balance.name)
        const sharePct = totalPatrimony > 0 ? (balance.currentBalance / totalPatrimony) * 100 : 0
        const yieldPct =
          balance.totalAmount > 0 ? (balance.totalYield / balance.totalAmount) * 100 : null

        return (
          <div
            key={balance.id}
            className="overflow-hidden rounded-lg border border-border bg-bg-surface"
          >
            {/* Accordion header — tap to toggle */}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              onClick={() => toggle(balance.id)}
            >
              {/* Avatar */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-small font-semibold"
                style={{ background: color.bg, color: color.fg }}
              >
                {initials}
              </div>

              {/* Name + share bar */}
              <div className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold">{balance.name}</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {balance.pendingYield ? (
                    <Badge variant="warning" size="sm">
                      Pendente
                    </Badge>
                  ) : (
                    <>
                      <span className="text-caption text-text-tertiary">
                        {sharePct.toFixed(1)}%
                      </span>
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(sharePct, 100)}%`,
                            background: color.fg,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Balance */}
              <div className="flex-shrink-0 text-right">
                <div className="text-body font-semibold tabular-nums">
                  {formatCurrency(balance.currentBalance)}
                </div>
                {!balance.pendingYield && yieldPct !== null && (
                  <div className="text-caption font-semibold text-positive-text">
                    yield {yieldPct.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Chevron */}
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-text-tertiary transition-transform duration-base ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Metric pills */}
            {isOpen && (
              <div className="flex flex-wrap gap-1.5 border-t border-border px-4 pb-3 pt-2.5">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-bg-subtle px-2 py-1 text-caption text-text-secondary">
                  Aportes{' '}
                  <strong className="font-semibold tabular-nums text-text-primary">
                    {formatCurrency(balance.totalAmount)}
                  </strong>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-positive-subtle px-2 py-1 text-caption text-positive-text">
                  Rendimentos{' '}
                  <strong className="font-semibold tabular-nums">
                    {formatCurrency(balance.totalYield)}
                  </strong>
                </div>
                {yieldPct !== null && (
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-bg-subtle px-2 py-1 text-caption text-text-secondary">
                    Yield{' '}
                    <strong className="font-semibold tabular-nums text-text-primary">
                      {yieldPct.toFixed(1)}%
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Months list */}
            {isOpen && balance.entries.length > 0 && (
              <div className="border-t border-border bg-bg-subtle">
                {balance.entries.map((entry) => {
                  const isPending = entry.amount !== null && entry.yieldAmount === null
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0 ${isPending ? 'bg-warning-subtle' : ''}`}
                    >
                      {/* Month label */}
                      <span
                        className={`min-w-[60px] text-caption font-medium ${isPending ? 'font-semibold text-warning-text' : 'text-text-secondary'}`}
                      >
                        {formatMonthName(referenceMonthToYearMonth(entry.referenceMonth))}
                      </span>

                      {/* Values stacked */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-caption">
                          <span className="text-label uppercase text-text-tertiary">A</span>
                          <span className="tabular-nums text-text-primary">
                            {entry.amount !== null ? (
                              formatCurrency(entry.amount)
                            ) : (
                              <span className="text-text-tertiary">—</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-caption">
                          <span className="text-label uppercase text-text-tertiary">R</span>
                          {entry.yieldAmount !== null ? (
                            <span className="font-semibold tabular-nums text-positive-text">
                              + {formatCurrency(entry.yieldAmount)}
                            </span>
                          ) : (
                            <span className="font-semibold text-warning-text">pendente</span>
                          )}
                        </div>
                        {entry.notes && (
                          <div className="truncate text-caption italic text-text-tertiary">
                            {entry.notes}
                          </div>
                        )}
                      </div>

                      {/* Edit action */}
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <InvestmentEntryDialog investmentTypeId={balance.id} existing={entry} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Action bar */}
            {isOpen && (
              <div
                className="flex gap-2 border-t border-border bg-bg-surface px-3 py-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex-1">
                  <InvestmentEntryDialog investmentTypeId={balance.id} />
                </div>
                <InvestmentTypeDialog mode="edit" type={{ id: balance.id, name: balance.name }} />
                <DeleteButton onDelete={() => deleteInvestmentType(balance.id)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
