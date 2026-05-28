'use client'

import { useState, useTransition } from 'react'
import { Archive, ArchiveRestore, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import {
  formatMonthAbbr,
  formatMonthName,
  referenceMonthToYearMonth,
  daysUntil,
} from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RowActions } from '@/components/ui/row-actions'
import { InvestmentTypeDialog } from '@/components/investimentos/InvestmentTypeDialog'
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog'
import { WithdrawalDialog } from '@/components/investimentos/WithdrawalDialog'
import {
  deleteInvestmentType,
  archiveInvestmentType,
  restoreInvestmentType,
} from '@/lib/actions/investments'
import { DEFAULT_INVESTMENT_TYPE_BG_COLOR, DEFAULT_INVESTMENT_TYPE_COLOR } from '@/lib/utils/color'
import { toast } from 'sonner'

const INITIAL_MONTH_LIMIT = 3

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
  color: string | null
  bgColor: string | null
  maturityDate: string | null
  archived: boolean
  totalAmount: number
  totalYield: number
  totalWithdrawn: number
  currentBalance: number
  pendingYield: boolean
  pendingReferenceMonth: string | null
  entries: Entry[]
}

type Props = {
  balances: Balance[]
  totalPatrimony: number
}

function MaturityBadge({
  maturityDate,
  currentBalance,
}: {
  maturityDate: string | null
  currentBalance: number
}) {
  if (!maturityDate) return null
  const days = daysUntil(maturityDate)
  if (days > 30) return null
  if (days < 0 && currentBalance <= 0) return null

  if (days < 0) {
    const abs = Math.abs(days)
    return (
      <Badge variant="negative">
        Vencido há {abs} {abs === 1 ? 'dia' : 'dias'}
      </Badge>
    )
  }
  if (days === 0) return <Badge variant="warning">Vence hoje</Badge>
  return (
    <Badge variant="warning">
      Vence em {days} {days === 1 ? 'dia' : 'dias'}
    </Badge>
  )
}

function AccordionItem({ balance, totalPatrimony }: { balance: Balance; totalPatrimony: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState(false)
  const [editTypeOpen, setEditTypeOpen] = useState(false)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const [, startTransition] = useTransition()

  const color = {
    bg: balance.bgColor ?? DEFAULT_INVESTMENT_TYPE_BG_COLOR,
    fg: balance.color ?? DEFAULT_INVESTMENT_TYPE_COLOR,
  }
  const initials = typeInitials(balance.name)
  const sharePct = totalPatrimony > 0 ? (balance.currentBalance / totalPatrimony) * 100 : 0
  const yieldPct = balance.totalAmount > 0 ? (balance.totalYield / balance.totalAmount) * 100 : null
  const pendingMonthLabel = balance.pendingReferenceMonth
    ? formatMonthAbbr(referenceMonthToYearMonth(balance.pendingReferenceMonth))
    : null
  const latestEntries = balance.entries.slice().reverse()
  const visibleEntries = expandedMonths
    ? latestEntries
    : latestEntries.slice(0, INITIAL_MONTH_LIMIT)
  const hiddenMonthsCount = latestEntries.length - visibleEntries.length

  const maturityDays = balance.maturityDate ? daysUntil(balance.maturityDate) : null
  const isExpired = maturityDays !== null && maturityDays < 0 && balance.currentBalance > 0

  const handleArchive = () => {
    startTransition(async () => {
      try {
        await archiveInvestmentType(balance.id)
      } catch {
        toast.error('Não é possível arquivar tipo com saldo.')
      }
    })
  }

  const handleRestore = () => {
    startTransition(async () => {
      try {
        await restoreInvestmentType(balance.id)
      } catch {
        toast.error('Erro ao restaurar.')
      }
    })
  }

  const archiveAction = balance.archived
    ? {
        label: 'Restaurar',
        icon: ArchiveRestore,
        onClick: handleRestore,
        variant: 'default' as const,
      }
    : balance.currentBalance === 0
      ? { label: 'Arquivar', icon: Archive, onClick: handleArchive, variant: 'default' as const }
      : undefined

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-surface">
      {/* Accordion header — tap to toggle */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setIsOpen((v) => !v)}
      >
        {/* Avatar */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-small font-semibold ${balance.archived ? 'opacity-50' : ''}`}
          style={{ background: color.bg, color: color.fg }}
        >
          {initials}
        </div>

        {/* Name + share bar */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="block truncate text-body font-semibold">{balance.name}</span>
            {balance.archived ? (
              <Badge variant="muted">Arquivado</Badge>
            ) : (
              <MaturityBadge
                maturityDate={balance.maturityDate}
                currentBalance={balance.currentBalance}
              />
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-caption text-text-tertiary">{sharePct.toFixed(1)}%</span>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(sharePct, 100)}%`,
                  background: color.fg,
                }}
              />
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="flex-shrink-0 text-right">
          <div className="text-body font-semibold tabular-nums">
            {formatCurrency(balance.currentBalance)}
          </div>
          {balance.archived ? null : balance.pendingYield ? (
            <div className="text-caption font-semibold text-warning-text">
              pend.{pendingMonthLabel ? ` ${pendingMonthLabel}` : ''}
            </div>
          ) : yieldPct !== null ? (
            <div className="text-caption font-semibold text-positive-text">
              rentab. {yieldPct.toFixed(1)}%
            </div>
          ) : null}
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
              Rentab.{' '}
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
          {visibleEntries.map((entry) => {
            const isPending = entry.referenceMonth === balance.pendingReferenceMonth
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0 ${isPending ? 'bg-warning-subtle' : ''}`}
              >
                {/* Month label */}
                <span
                  className={`min-w-16 text-caption font-medium ${isPending ? 'font-semibold text-warning-text' : 'text-text-secondary'}`}
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
                    ) : isPending ? (
                      <span className="font-semibold text-warning-text">pendente</span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
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
          {!expandedMonths && hiddenMonthsCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpandedMonths(true)}
              className="h-auto w-full rounded-none border-t border-border bg-accent-subtle px-4 py-2.5 text-accent-text hover:bg-accent-subtle hover:text-accent-text hover:opacity-90"
            >
              Ver mais {hiddenMonthsCount}{' '}
              {hiddenMonthsCount === 1 ? 'mês investido' : 'meses investidos'}
            </Button>
          )}
        </div>
      )}

      {/* Action bar */}
      {isOpen && (
        <div
          className="flex items-center gap-2 border-t border-border bg-bg-surface px-3 py-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1 items-center gap-2">
            {!balance.archived && <InvestmentEntryDialog investmentTypeId={balance.id} />}
            {isExpired && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setWithdrawalOpen(true)}
                >
                  Registrar resgate
                </Button>
                <WithdrawalDialog
                  investmentTypes={[{ id: balance.id, name: balance.name }]}
                  initialTypeId={balance.id}
                  initialAmount={balance.currentBalance}
                  open={withdrawalOpen}
                  onOpenChange={setWithdrawalOpen}
                />
              </>
            )}
          </div>
          <div className="group flex items-center gap-1">
            <RowActions
              onEdit={() => setEditTypeOpen(true)}
              onDelete={() => deleteInvestmentType(balance.id)}
              deleteTitle="Excluir tipo de investimento"
              deleteDescription="Todos os registros mensais serão removidos. Essa ação não pode ser desfeita."
              additionalActions={archiveAction ? [archiveAction] : undefined}
            />
            <InvestmentTypeDialog
              mode="edit"
              type={{
                id: balance.id,
                name: balance.name,
                color: balance.color,
                maturityDate: balance.maturityDate,
              }}
              open={editTypeOpen}
              onOpenChange={setEditTypeOpen}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function InvestmentTypeAccordion({ balances, totalPatrimony }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {balances.map((balance) => (
        <AccordionItem key={balance.id} balance={balance} totalPatrimony={totalPatrimony} />
      ))}
    </div>
  )
}
