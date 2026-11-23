'use client'

import { useState, useTransition } from 'react'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { toAmount } from '@/lib/utils/currency'
import { toggleFixedExpensePaid, deleteFixedExpense } from '@/lib/actions/transactions'
import { FixedExpenseEditButton } from './FixedExpenseEditDialog'
import { TxList, ListFooter } from '@/components/ui/tx-list'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { RowActions } from '@/components/ui/row-actions'
import { cn } from '@/lib/utils/cn'
import { Check } from 'lucide-react'

type FixedExpense = {
  id: string
  name: string
  amount: string
  dueDay: number
  paid: boolean
  categoryId: string | null
  accountId: string | null
  category: { name: string; color: string | null; bgColor: string | null } | null
  account: { name: string } | null
}

type RowState = 'pending' | 'paid' | 'viaFatura'

const chipCls = 'flex-shrink-0 rounded-sm px-1.5 py-0'

function DueChip({ dueDay, todayDay }: { dueDay: number; todayDay: number }) {
  const daysUntil = dueDay - todayDay
  if (daysUntil < 0) {
    return (
      <Badge variant="negative" size="sm" className={chipCls}>
        vencido
      </Badge>
    )
  }
  if (daysUntil <= 1) {
    return (
      <Badge variant="warning" size="sm" className={chipCls}>
        {daysUntil === 0 ? 'hoje' : 'amanhã'}
      </Badge>
    )
  }
  return null
}

function FixedExpenseRow({
  expense: e,
  state,
  isCurrentMonth,
  todayDay,
}: {
  expense: FixedExpense
  state: RowState
  isCurrentMonth: boolean
  todayDay: number
}) {
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)

  const toggle = () => {
    startTransition(async () => {
      await toggleFixedExpensePaid(e.id, !e.paid)
    })
  }

  const dayLabel = state === 'pending' ? `Vence dia ${e.dueDay}` : `Dia ${e.dueDay}`
  const meta = [dayLabel, e.account?.name].filter(Boolean).join(' · ')

  return (
    <div
      className={cn(
        'group flex items-center gap-2 border-t border-border py-3 pl-4 pr-5 transition-colors duration-fast first:border-t-0 hover:bg-bg-subtle',
        isPending && 'opacity-40'
      )}
    >
      {state === 'viaFatura' ? (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
          <span className="h-5 w-5 rounded-full border border-border bg-bg-subtle" />
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          aria-label={e.paid ? 'Marcar como pendente' : 'Marcar como pago'}
          className="peer flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        >
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-fast',
              e.paid ? 'bg-positive' : 'border-2 border-border-strong hover:border-positive'
            )}
          >
            {e.paid && <Check className="h-3 w-3 text-text-inverse" strokeWidth={3} />}
          </span>
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-body font-medium',
            state === 'pending' ? 'text-text-primary' : 'text-text-secondary'
          )}
        >
          {e.name}
        </p>
        <div className="flex min-w-0 items-center gap-1.5 text-caption text-text-tertiary">
          <span className="truncate">{meta}</span>
          {state === 'pending' && isCurrentMonth && (
            <DueChip dueDay={e.dueDay} todayDay={todayDay} />
          )}
          {state === 'viaFatura' && (
            <Badge size="sm" className={chipCls}>
              via fatura
            </Badge>
          )}
        </div>
      </div>

      <span
        className={cn(
          'flex-shrink-0 text-body font-semibold tabular-nums',
          state === 'pending' ? 'text-text-primary' : 'text-text-tertiary'
        )}
      >
        − <SensitiveAmount value={toAmount(e.amount)} />
      </span>

      <RowActions onEdit={() => setEditOpen(true)} onDelete={() => deleteFixedExpense(e.id)} />
      <FixedExpenseEditButton expense={e} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}

export function FixedExpenseList({
  expenses,
  isCurrentMonth,
  todayDay,
  creditAccountIds: creditAccountIdsProp,
  emptyAction,
}: {
  expenses: FixedExpense[]
  isCurrentMonth: boolean
  todayDay: number
  creditAccountIds?: string[]
  emptyAction?: React.ReactNode
}) {
  if (expenses.length === 0) {
    return (
      <TxList>
        <EmptyState title="Nenhum gasto fixo neste mês" action={emptyAction} />
      </TxList>
    )
  }

  const creditAccountIds = new Set(creditAccountIdsProp ?? [])
  const isViaFatura = (e: FixedExpense) => e.accountId !== null && creditAccountIds.has(e.accountId)

  // Gasto fixo de crédito em mês de fatura é pago pela fatura — fora da contagem.
  const viaFatura = expenses.filter(isViaFatura)
  const own = expenses.filter((e) => !isViaFatura(e))
  const pending = own.filter((e) => !e.paid)
  const paid = own.filter((e) => e.paid)
  const pendingTotal = pending.reduce((s, e) => s + toAmount(e.amount), 0)

  const rows: { expense: FixedExpense; state: RowState }[] = [
    ...pending.map((expense) => ({ expense, state: 'pending' as const })),
    ...paid.map((expense) => ({ expense, state: 'paid' as const })),
    ...viaFatura.map((expense) => ({ expense, state: 'viaFatura' as const })),
  ]

  return (
    <TxList>
      {own.length > 0 && (
        <div className="px-5 py-3">
          <Progress
            value={paid.length}
            max={own.length}
            aria-label="Gastos fixos pagos"
            className="h-1"
            indicatorClassName="bg-positive"
          />
        </div>
      )}

      {rows.map(({ expense, state }) => (
        <FixedExpenseRow
          key={expense.id}
          expense={expense}
          state={state}
          isCurrentMonth={isCurrentMonth}
          todayDay={todayDay}
        />
      ))}

      <ListFooter
        label="Falta pagar"
        value={
          <>
            − <SensitiveAmount value={pendingTotal} />
          </>
        }
      />
    </TxList>
  )
}
