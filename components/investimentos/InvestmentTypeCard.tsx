'use client'

import { useState, useTransition } from 'react'
import { Archive, ArchiveRestore } from 'lucide-react'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import {
  formatMonthName,
  formatMonthAbbr,
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
  deleteInvestment,
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
  balance: Balance
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

export function InvestmentTypeCard({ balance }: Props) {
  const color = {
    bg: balance.bgColor ?? DEFAULT_INVESTMENT_TYPE_BG_COLOR,
    fg: balance.color ?? DEFAULT_INVESTMENT_TYPE_COLOR,
  }
  const initials = typeInitials(balance.name)
  const { entries, totalAmount, totalYield } = balance

  const [editTypeOpen, setEditTypeOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const [, startTransition] = useTransition()

  const maturityDays = balance.maturityDate ? daysUntil(balance.maturityDate) : null
  const isExpired = maturityDays !== null && maturityDays < 0 && balance.currentBalance > 0

  const confirmedEntries = entries.filter((e) => e.amount !== null)
  const confirmedYieldEntries = entries.filter((e) => e.yieldAmount !== null)
  const avgAporte =
    confirmedEntries.length > 0
      ? confirmedEntries.reduce((s, e) => s + (e.amount ?? 0), 0) / confirmedEntries.length
      : null
  const avgYield =
    confirmedYieldEntries.length > 0
      ? confirmedYieldEntries.reduce((s, e) => s + (e.yieldAmount ?? 0), 0) /
        confirmedYieldEntries.length
      : null
  const yieldPct = totalAmount > 0 ? (totalYield / totalAmount) * 100 : null

  const pendingMonthLabel = balance.pendingReferenceMonth
    ? formatMonthAbbr(referenceMonthToYearMonth(balance.pendingReferenceMonth))
    : null
  const latestEntries = entries.slice().reverse()
  const visibleEntries = showAllMonths ? latestEntries : latestEntries.slice(0, INITIAL_MONTH_LIMIT)
  const hiddenMonthsCount = latestEntries.length - visibleEntries.length

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
    : Math.round(balance.currentBalance * 100) <= 0
      ? {
          label: 'Arquivar',
          icon: Archive,
          onClick: handleArchive,
          variant: 'default' as const,
        }
      : undefined

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm">
      {/* Header */}
      <header className="group flex items-center gap-4 border-b border-border px-5 py-4">
        {/* Avatar */}
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-small font-semibold ${balance.archived ? 'opacity-50' : ''}`}
          style={{ background: color.bg, color: color.fg }}
        >
          {initials}
        </div>

        {/* Name + sub-info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5 text-h3">
            {balance.name}
            {balance.archived ? (
              <Badge variant="muted">Arquivado</Badge>
            ) : (
              <>
                {balance.pendingYield && (
                  <Badge variant="warning">
                    Rendimento pendente{pendingMonthLabel ? ` · ${pendingMonthLabel}` : ''}
                  </Badge>
                )}
                <MaturityBadge
                  maturityDate={balance.maturityDate}
                  currentBalance={balance.currentBalance}
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-caption text-text-tertiary">
            <span>
              Aportes{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                <SensitiveAmount value={totalAmount} />
              </strong>
            </span>
            <span>
              Rendimentos{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                <SensitiveAmount value={totalYield} />
              </strong>
            </span>
            {yieldPct !== null && (
              <span>
                Rentab. acum.{' '}
                <strong className="font-semibold tabular-nums text-text-primary">
                  {yieldPct.toFixed(1)}%
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-label text-text-tertiary">Saldo atual</span>
          <span className="text-h2 tabular-nums">
            <SensitiveAmount value={balance.currentBalance} />
          </span>
        </div>

        {/* Actions */}
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
      </header>

      {/* Months table */}
      {entries.length > 0 && (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-44" />
            <col className="w-40" />
            <col className="w-44" />
            <col />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-bg-subtle">
              <th className="px-5 py-2 text-left text-label text-text-tertiary">Mês</th>
              <th className="whitespace-nowrap px-5 py-2 text-right text-label text-text-tertiary">
                Aporte
              </th>
              <th className="whitespace-nowrap px-5 py-2 text-right text-label text-text-tertiary">
                Rendimento
              </th>
              <th className="px-5 py-2 text-left text-label text-text-tertiary">Nota</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const isPending = entry.referenceMonth === balance.pendingReferenceMonth
              return (
                <tr
                  key={entry.id}
                  className={`group border-t border-border ${
                    isPending ? 'bg-warning-subtle' : 'hover:bg-bg-subtle'
                  }`}
                >
                  <td
                    className={`px-5 py-2.5 text-small ${isPending ? 'font-semibold text-warning-text' : 'text-text-secondary'}`}
                  >
                    {formatMonthName(referenceMonthToYearMonth(entry.referenceMonth))}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right text-small tabular-nums">
                    {entry.amount !== null ? (
                      <SensitiveAmount value={entry.amount} />
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right text-small tabular-nums">
                    {entry.yieldAmount !== null ? (
                      <span className="font-semibold text-positive-text">
                        + <SensitiveAmount value={entry.yieldAmount} />
                      </span>
                    ) : isPending ? (
                      <span className="font-semibold text-warning-text">pendente</span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="truncate px-5 py-2.5 text-small italic text-text-secondary">
                    {entry.notes ? (
                      entry.notes
                    ) : isPending ? (
                      <span className="text-warning-text">Aguardando lançamento do rendimento</span>
                    ) : (
                      <span className="not-italic text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <RowActions
                      onEdit={() => setEditingEntryId(entry.id)}
                      onDelete={!isPending ? () => deleteInvestment(entry.id) : undefined}
                      triggerClassName={isPending ? 'hover:bg-warning-subtle' : undefined}
                    />
                    <InvestmentEntryDialog
                      investmentTypeId={balance.id}
                      existing={entry}
                      open={editingEntryId === entry.id}
                      onOpenChange={(v) => !v && setEditingEntryId(null)}
                    />
                  </td>
                </tr>
              )
            })}
            {!showAllMonths && hiddenMonthsCount > 0 && (
              <tr className="border-t border-border">
                <td colSpan={5} className="p-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllMonths(true)}
                    className="h-auto w-full rounded-none bg-accent-subtle px-5 py-2.5 text-accent-text hover:bg-accent-subtle hover:text-accent-text hover:opacity-90"
                  >
                    Ver mais {hiddenMonthsCount}{' '}
                    {hiddenMonthsCount === 1 ? 'mês investido' : 'meses investidos'}
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
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
        <div className="flex gap-4 text-caption text-text-tertiary">
          {avgAporte !== null && (
            <span>
              Média aporte{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                <SensitiveAmount value={avgAporte} />
              </strong>
            </span>
          )}
          {avgYield !== null && (
            <span>
              Média rendim.{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                <SensitiveAmount value={avgYield} />
              </strong>
            </span>
          )}
          {yieldPct !== null && (
            <span>
              Rentab. acum.{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                ~{yieldPct.toFixed(1)}%
              </strong>
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
