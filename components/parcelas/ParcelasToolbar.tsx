'use client'

import { useState, useMemo } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
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
  nextChargeDate: string | null
  totalAmount: number
  totalInstallments: number
  paidInstallments: number
  remainingInstallments: number
  installmentAmount: number
  remainingAmount: number
  endLabel?: string
}

type Sort = 'expensive' | 'highest-balance' | 'soonest-end'

function applySort(groups: Group[], sort: Sort): Group[] {
  const copy = [...groups]
  switch (sort) {
    case 'expensive':
      return copy.sort((a, b) => b.installmentAmount - a.installmentAmount)
    case 'highest-balance':
      return copy.sort((a, b) => b.remainingAmount - a.remainingAmount)
    case 'soonest-end':
      return copy.sort((a, b) => a.remainingInstallments - b.remainingInstallments)
    default:
      return copy
  }
}

const SORTS: { key: Sort; label: string }[] = [
  { key: 'expensive', label: 'Maior custo mensal' },
  { key: 'highest-balance', label: 'Maior saldo restante' },
  { key: 'soonest-end', label: 'Termina mais cedo' },
]

export function ParcelasToolbar({ groups }: { groups: Group[] }) {
  const [accountId, setAccountId] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('expensive')

  const accounts = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    for (const g of groups) {
      if (!seen.has(g.accountId)) {
        seen.add(g.accountId)
        result.push({ id: g.accountId, name: g.accountName })
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [groups])

  const filtered = useMemo(() => {
    const byAccount = accountId === 'all' ? groups : groups.filter((g) => g.accountId === accountId)
    return applySort(byAccount, sort)
  }, [groups, accountId, sort])

  const totalMensal = filtered.reduce((s, g) => s + g.installmentAmount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {accounts.length > 1 && (
          <div className="flex items-center gap-2 text-caption text-text-secondary">
            <span>Conta:</span>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-8 w-auto bg-bg-input px-3 text-caption font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-caption text-text-secondary">
          <span>Ordenar:</span>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-8 w-auto bg-bg-input px-3 text-caption font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-label text-text-tertiary">Parcelas ativas</p>
        <p className="text-caption text-text-tertiary">
          <span className="font-semibold tabular-nums text-text-primary">
            {formatCurrency(totalMensal)}/mês
          </span>
          {' · '}
          <span className="tabular-nums">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'compra' : 'compras'}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhuma parcela nesta conta." />
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
