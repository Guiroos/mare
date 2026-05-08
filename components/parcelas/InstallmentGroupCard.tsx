'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RowActions } from '@/components/ui/row-actions'
import { formatCurrency } from '@/lib/utils/currency'
import { deleteInstallmentGroup } from '@/lib/actions/transactions'
import { InstallmentGroupEditButton } from './InstallmentGroupEditDialog'

const MAX_SEGMENTS = 24

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
  installmentAmount: number
  remainingAmount: number
  endLabel?: string
}

export function InstallmentGroupCard({ group }: { group: Group }) {
  const [editOpen, setEditOpen] = useState(false)
  const pct = Math.round((group.paidInstallments / group.totalInstallments) * 100)
  const useSegments = group.totalInstallments <= MAX_SEGMENTS

  return (
    <Card
      padding="none"
      className="group space-y-3 px-5 py-4 transition-colors duration-fast hover:border-border-strong"
    >
      {/* Top row: avatar + identity + actions */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-small font-semibold text-text-secondary">
          {group.name[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold leading-tight">{group.name}</p>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
            <Badge variant="muted" dot={group.categoryColor}>
              {group.categoryName}
            </Badge>
            <span className="text-text-tertiary">·</span>
            <span className="truncate text-caption text-text-tertiary">{group.accountName}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <RowActions
            onEdit={() => setEditOpen(true)}
            onDelete={() => deleteInstallmentGroup(group.id)}
            deleteTitle="Excluir parcelamento"
            deleteDescription={`Isso irá excluir "${group.name}" e todas as suas parcelas. Essa ação não pode ser desfeita.`}
          />
          <InstallmentGroupEditButton
            group={{
              id: group.id,
              name: group.name,
              categoryId: group.categoryId,
              accountId: group.accountId,
              totalAmount: group.totalAmount,
            }}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </div>
      </div>

      {/* Segmented progress */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-caption font-medium text-text-secondary">
            Parcela {group.paidInstallments} de {group.totalInstallments}
          </p>
          <p className="text-caption font-semibold text-text-primary">{pct}%</p>
        </div>
        {useSegments ? (
          <div className="flex gap-0.5">
            {Array.from({ length: group.totalInstallments }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < group.paidInstallments ? 'bg-accent' : 'bg-bg-muted'}`}
              />
            ))}
          </div>
        ) : (
          <Progress
            value={group.paidInstallments}
            max={group.totalInstallments}
            className="h-1.5"
          />
        )}
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-4 gap-3 pt-0.5">
        <div className="space-y-0.5">
          <p className="text-label uppercase text-text-tertiary">por mês</p>
          <p className="text-small font-semibold tabular-nums text-accent-text">
            {formatCurrency(group.installmentAmount)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-label uppercase text-text-tertiary">restante</p>
          <p className="text-small font-semibold tabular-nums">
            {formatCurrency(group.remainingAmount)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-label uppercase text-text-tertiary">total</p>
          <p className="text-small tabular-nums text-text-secondary">
            {formatCurrency(group.totalAmount)}
          </p>
        </div>
        {group.endLabel && (
          <div className="space-y-0.5">
            <p className="text-label uppercase text-text-tertiary">termina</p>
            <p className="text-small tabular-nums text-text-secondary">{group.endLabel}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
