'use client'

import { useState, useTransition } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { toggleFixedExpensePaid, deleteFixedExpense } from '@/lib/actions/transactions'
import { DeleteButton } from '@/components/ui/delete-button'
import { FixedExpenseEditButton } from './FixedExpenseEditDialog'
import { TxList } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'
import { Check, ChevronDown } from 'lucide-react'

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

function DueBadge({
  dueDay,
  paid,
  isCurrentMonth,
  todayDay,
  isPastMonth,
}: {
  dueDay: number
  paid: boolean
  isCurrentMonth: boolean
  todayDay: number
  isPastMonth: boolean
}) {
  if (paid) return null

  const daysUntil = dueDay - todayDay
  const overdue = isPastMonth || (isCurrentMonth && daysUntil < 0)
  const urgent = isCurrentMonth && daysUntil >= 0 && daysUntil <= 3

  if (overdue) {
    return (
      <span className="rounded bg-negative-subtle px-1.5 py-0.5 text-label text-negative-text">
        Vencido
      </span>
    )
  }
  if (urgent) {
    return (
      <span className="rounded bg-warning-subtle px-1.5 py-0.5 text-label text-warning-text">
        {daysUntil === 0 ? 'Vence hoje' : `Vence em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`}
      </span>
    )
  }
  return (
    <span className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
      Dia {dueDay}
    </span>
  )
}

function FixedExpenseRow({
  expense: e,
  isCurrentMonth,
  todayDay,
  isPastMonth,
}: {
  expense: FixedExpense
  isCurrentMonth: boolean
  todayDay: number
  isPastMonth: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const col = e.category

  const toggle = () => {
    startTransition(async () => {
      await toggleFixedExpensePaid(e.id, !e.paid)
    })
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-b border-border px-4 py-3 transition-all last:border-0 hover:bg-bg-subtle',
        isPending && 'opacity-40',
        e.paid && 'opacity-50'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={toggle}
        disabled={isPending}
        aria-label={e.paid ? 'Marcar como pendente' : 'Marcar como pago'}
        className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all',
          e.paid ? 'border-positive bg-positive' : 'border-border-strong bg-transparent'
        )}
      >
        {e.paid && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-body font-medium',
            e.paid ? 'text-text-tertiary line-through' : 'text-text-primary'
          )}
        >
          {e.name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {col && (
            <>
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: col.color ?? undefined }}
              />
              <span className="text-caption font-medium text-text-secondary">{col.name}</span>
            </>
          )}
          {e.account && (
            <>
              <span className="text-caption text-text-tertiary">·</span>
              <span className="text-caption text-text-tertiary">{e.account.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
        <FixedExpenseEditButton expense={e} />
        <DeleteButton onDelete={() => deleteFixedExpense(e.id)} />
      </div>

      {/* Right */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'text-body font-semibold tabular-nums',
            e.paid ? 'text-text-tertiary' : 'text-negative-text'
          )}
        >
          {formatCurrency(Number(e.amount))}
        </span>
        <DueBadge
          dueDay={e.dueDay}
          paid={e.paid}
          isCurrentMonth={isCurrentMonth}
          todayDay={todayDay}
          isPastMonth={isPastMonth}
        />
      </div>
    </div>
  )
}

export function FixedExpenseList({
  expenses,
  isCurrentMonth,
  isPastMonth,
  todayDay,
}: {
  expenses: FixedExpense[]
  yearMonth: string
  isCurrentMonth: boolean
  isPastMonth: boolean
  todayDay: number
}) {
  const [showPaid, setShowPaid] = useState(false)

  if (expenses.length === 0) {
    return <EmptyState title="Nenhum gasto fixo neste mês." />
  }

  const pending = expenses.filter((e) => !e.paid)
  const paid = expenses.filter((e) => e.paid)

  return (
    <TxList>
      {pending.map((e) => (
        <FixedExpenseRow
          key={e.id}
          expense={e}
          isCurrentMonth={isCurrentMonth}
          todayDay={todayDay}
          isPastMonth={isPastMonth}
        />
      ))}

      {paid.length > 0 && (
        <>
          <button
            onClick={() => setShowPaid((v) => !v)}
            className="flex w-full items-center justify-between border-t border-border bg-bg-subtle px-4 py-2 text-label uppercase text-text-tertiary transition-colors hover:bg-bg-subtle"
          >
            <span>Pagos · {paid.length}</span>
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform duration-base"
              style={{ transform: showPaid ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
          {showPaid &&
            paid.map((e) => (
              <FixedExpenseRow
                key={e.id}
                expense={e}
                isCurrentMonth={isCurrentMonth}
                todayDay={todayDay}
                isPastMonth={isPastMonth}
              />
            ))}
        </>
      )}
    </TxList>
  )
}
