'use client'

import { useState, useMemo } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { InstallmentGroupCard } from './InstallmentGroupCard'
import { formatCurrency } from '@/lib/utils/currency'

type Group = {
  id: string
  name: string
  categoryId: string
  accountId: string
  accountName: string
  categoryName: string
  categoryColor?: string
  startDate: string
  nextChargeMonth: string | null
  totalAmount: number
  totalInstallments: number
  paidInstallments: number
  remainingInstallments: number
  installmentAmount: number
  remainingAmount: number
  endLabel?: string
}

type Filter = 'all' | 'week' | 'next-month' | 'almost-done'
type Sort = 'expensive' | 'soonest' | 'most-remaining'

function getNextMonth(): string {
  const d = new Date()
  const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()
  const m = String((d.getMonth() + 2) % 12 || 12).padStart(2, '0')
  return `${y}-${m}`
}

function isThisWeek(startDate: string): boolean {
  const day = parseInt(startDate.split('-')[2], 10)
  const today = new Date()
  const todayDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const diff = (day - todayDay + daysInMonth) % daysInMonth
  return diff <= 7
}

function applyFilter(groups: Group[], filter: Filter): Group[] {
  const nextMonth = getNextMonth()
  switch (filter) {
    case 'week':
      return groups.filter((g) => isThisWeek(g.startDate))
    case 'next-month':
      return groups.filter((g) => g.nextChargeMonth === nextMonth)
    case 'almost-done':
      return groups.filter((g) => g.remainingInstallments <= 2)
    default:
      return groups
  }
}

function applySort(groups: Group[], sort: Sort): Group[] {
  const copy = [...groups]
  switch (sort) {
    case 'expensive':
      return copy.sort((a, b) => b.installmentAmount - a.installmentAmount)
    case 'soonest': {
      const today = new Date().getDate()
      const daysUntil = (day: number) => {
        const d = new Date()
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        return (day - today + daysInMonth) % daysInMonth
      }
      return copy.sort((a, b) => {
        const dayA = parseInt(a.startDate.split('-')[2], 10)
        const dayB = parseInt(b.startDate.split('-')[2], 10)
        return daysUntil(dayA) - daysUntil(dayB)
      })
    }
    case 'most-remaining':
      return copy.sort((a, b) => b.remainingInstallments - a.remainingInstallments)
    default:
      return copy
  }
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'week', label: 'Esta semana' },
  { key: 'next-month', label: 'Próximo mês' },
  { key: 'almost-done', label: 'Quase quitadas' },
]

const SORTS: { key: Sort; label: string }[] = [
  { key: 'expensive', label: 'Mais cara primeiro' },
  { key: 'soonest', label: 'Próximo vencimento' },
  { key: 'most-remaining', label: 'Mais parcelas restantes' },
]

export function ParcelasToolbar({ groups }: { groups: Group[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('expensive')

  const filtered = useMemo(
    () => applySort(applyFilter(groups, filter), sort),
    [groups, filter, sort]
  )

  const totalMensal = filtered.reduce((s, g) => s + g.installmentAmount, 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ key, label }) => {
            const count = key === 'all' ? groups.length : applyFilter(groups, key).length
            const isActive = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={[
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-caption font-medium transition-colors duration-fast',
                  isActive
                    ? 'border-transparent bg-accent-subtle font-semibold text-accent-text'
                    : 'border-border bg-bg-surface text-text-secondary hover:text-text-primary',
                ].join(' ')}
              >
                {label}
                {(key === 'all' || count !== groups.length) && count > 0 && (
                  <span
                    className={[
                      'rounded px-1 text-caption font-bold',
                      isActive
                        ? 'bg-accent-subtle text-accent-text'
                        : 'bg-bg-subtle text-text-tertiary',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Native select intentional: DS Select is h-12 (form-sized); toolbar needs compact h-8 */}
        <div className="flex items-center gap-2 text-caption text-text-secondary">
          <span>Ordenar:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-8 rounded-md border border-border bg-bg-surface px-2 text-caption font-medium text-text-primary"
          >
            {SORTS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section heading */}
      <div className="flex items-baseline justify-between">
        <p className="text-label uppercase text-text-tertiary">Parcelas ativas</p>
        <p className="text-caption text-text-tertiary">
          <strong className="tabular-nums text-text-primary">
            {formatCurrency(totalMensal)}/mês
          </strong>
          {' · '}
          {filtered.length} {filtered.length === 1 ? 'compra' : 'compras'}
        </p>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState title="Nenhuma parcela nesta categoria." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((group) => (
            <InstallmentGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
