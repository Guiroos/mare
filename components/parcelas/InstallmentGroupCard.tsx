'use client'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/currency'
import { InstallmentGroupEditButton } from './InstallmentGroupEditDialog'

type Group = {
  id: string
  name: string
  categoryId: string
  accountId: string
  accountName: string
  categoryName: string
  categoryColor?: string
  totalAmount: number
  totalInstallments: number
  paidInstallments: number
  installmentAmount: number
  remainingAmount: number
  endLabel?: string
}

export function InstallmentGroupCard({ group }: { group: Group }) {
  return (
    <div className="space-y-3 rounded-xl border bg-bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-semibold leading-tight">{group.name}</p>
          <p className="text-xs text-text-secondary">{group.accountName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="muted" dot={group.categoryColor}>
            {group.categoryName}
          </Badge>
          <InstallmentGroupEditButton
            group={{
              id: group.id,
              name: group.name,
              categoryId: group.categoryId,
              accountId: group.accountId,
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Progress value={group.paidInstallments} max={group.totalInstallments} className="h-1.5" />
        <p className="text-xs text-text-secondary">
          Parcela {group.paidInstallments} de {group.totalInstallments}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <div>
          <p className="text-xs text-text-secondary">por mês</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(group.installmentAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">restante</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(group.remainingAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">total</p>
          <p className="text-sm tabular-nums text-text-secondary">
            {formatCurrency(group.totalAmount)}
          </p>
        </div>
        {group.endLabel && (
          <div>
            <p className="text-xs text-text-secondary">termina em</p>
            <p className="text-sm tabular-nums text-text-secondary">{group.endLabel}</p>
          </div>
        )}
      </div>
    </div>
  )
}
