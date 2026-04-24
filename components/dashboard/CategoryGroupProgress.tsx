'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TxList } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { ChevronDown } from 'lucide-react'

type CategoryDetail = {
  id: string
  name: string
  budget: number
  spent: number
  color?: string
  bgColor?: string
}

type Group = {
  id: string
  name: string
  totalBudget: number
  totalSpent: number
  categories: CategoryDetail[]
}

function ProgressBar({ value, max, over }: { value: number; max: number; over: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          over ? 'bg-negative' : pct >= 85 ? 'bg-warning' : 'bg-positive'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function CategoryGroupProgress({ groups }: { groups: Group[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (groups.length === 0) {
    return <EmptyState title="Nenhum grupo de categoria criado ainda." />
  }

  return (
    <TxList>
      {groups.map((group) => {
        const over = group.totalBudget > 0 && group.totalSpent > group.totalBudget
        const isOpen = expanded.has(group.id)

        const toggle = () => {
          setExpanded((prev) => {
            const next = new Set(prev)
            if (isOpen) next.delete(group.id)
            else next.add(group.id)
            return next
          })
        }

        return (
          <div key={group.id} className="border-b border-border last:border-0">
            <button
              onClick={toggle}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-bg-subtle"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-small font-semibold text-text-primary">{group.name}</span>
                  <span
                    className={cn(
                      'text-caption font-semibold tabular-nums',
                      over ? 'text-negative-text' : 'text-text-secondary'
                    )}
                  >
                    {formatCurrency(group.totalSpent)}
                    {group.totalBudget > 0 && (
                      <span className="font-normal text-text-tertiary">
                        {' '}
                        / {formatCurrency(group.totalBudget)}
                      </span>
                    )}
                  </span>
                </div>
                <ProgressBar
                  value={group.totalSpent}
                  max={group.totalBudget || group.totalSpent || 1}
                  over={over}
                />
              </div>
              <ChevronDown
                className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary transition-transform duration-base"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {isOpen && (
              <div className="border-t border-border">
                {group.categories.map((cat) => {
                  const catOver = cat.budget > 0 && cat.spent > cat.budget
                  const catPct = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 border-b border-border bg-bg-subtle px-4 py-2.5 last:border-0"
                    >
                      {cat.color && (
                        <span
                          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ background: cat.color }}
                        />
                      )}
                      <span className="flex-1 truncate text-caption text-text-secondary">
                        {cat.name}
                      </span>
                      <div className="h-1 w-20 flex-shrink-0 overflow-hidden rounded-full bg-bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            catOver ? 'bg-negative' : catPct >= 85 ? 'bg-warning' : 'bg-positive'
                          )}
                          style={{ width: `${Math.min(catPct, 100)}%` }}
                        />
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span
                          className={cn(
                            'text-caption font-semibold tabular-nums',
                            catOver ? 'text-negative-text' : 'text-text-secondary'
                          )}
                        >
                          {formatCurrency(cat.spent)}
                        </span>
                        {cat.budget > 0 && (
                          <span className="text-caption tabular-nums text-text-tertiary">
                            {' '}
                            / {formatCurrency(cat.budget)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </TxList>
  )
}
