import { ReactNode, HTMLAttributes } from 'react'
import { Check } from 'lucide-react'

/* TxList — container */
interface TxListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}
export function TxList({ className = '', children, ...props }: TxListProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

/* TxGroupHeader — date row separating groups */
interface TxGroupHeaderProps {
  date: ReactNode
  total?: ReactNode
  className?: string
}
export function TxGroupHeader({ date, total, className = '' }: TxGroupHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border bg-bg-subtle px-5 py-3 ${className}`}
    >
      <span className="text-caption font-semibold text-text-secondary">{date}</span>
      {total != null && (
        <span className="text-caption font-semibold tabular-nums text-text-secondary">{total}</span>
      )}
    </div>
  )
}

/* TxItem — generic transaction row */
interface TxItemProps {
  dot?: ReactNode
  dotBg?: string
  dotColor?: string
  name: ReactNode
  meta?: ReactNode
  amount: ReactNode
  amountTone?: 'pos' | 'neg'
  installment?: ReactNode
  onClick?: () => void
  strike?: boolean
  className?: string
}

const rowBase =
  'flex items-center gap-4 py-4 px-5 border-b border-border last:border-b-0 ' +
  'transition-colors duration-fast cursor-pointer hover:bg-bg-subtle'

export function TxItem({
  dot,
  dotBg,
  dotColor,
  name,
  meta,
  amount,
  amountTone,
  installment,
  onClick,
  strike = false,
  className = '',
}: TxItemProps) {
  const amountCls =
    (amountTone === 'pos'
      ? 'text-positive-text'
      : amountTone === 'neg'
        ? 'text-negative-text'
        : 'text-text-primary') + (strike ? ' line-through !text-text-tertiary' : '')
  const nameCls = strike ? 'line-through text-text-tertiary' : 'text-text-primary'

  return (
    <div className={`${rowBase} ${className}`} onClick={onClick}>
      {dot !== undefined && (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-body font-semibold"
          style={{ background: dotBg, color: dotColor }}
        >
          {dot}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-body font-medium ${nameCls}`}>{name}</div>
        {meta && (
          <div className="mt-0.5 flex items-center gap-2 text-caption text-text-tertiary">
            {meta}
            {installment && (
              <span className="rounded border border-border bg-bg-subtle px-1 py-0.5 text-label text-text-tertiary">
                {installment}
              </span>
            )}
          </div>
        )}
      </div>
      <span className={`shrink-0 text-body font-semibold tabular-nums ${amountCls}`}>{amount}</span>
    </div>
  )
}

/* FixedExpenseItem — row with done/undone checkbox */
interface FixedExpenseItemProps extends Omit<TxItemProps, 'dot' | 'dotBg' | 'dotColor' | 'strike'> {
  done: boolean
  onToggle?: (done: boolean) => void
}

export function FixedExpenseItem({
  done,
  onToggle,
  name,
  meta,
  amount,
  amountTone,
  installment,
  className = '',
}: FixedExpenseItemProps) {
  const amountCls =
    (amountTone === 'pos'
      ? 'text-positive-text'
      : amountTone === 'neg'
        ? 'text-negative-text'
        : 'text-text-primary') + (done ? ' line-through !text-text-tertiary' : '')

  return (
    <div className={`${rowBase} ${className}`}>
      <button
        type="button"
        onClick={() => onToggle?.(!done)}
        aria-pressed={done}
        className={
          'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md ' +
          'border-2 transition-[background,border-color] duration-fast ' +
          (done ? 'border-positive bg-positive' : 'border-border-strong bg-transparent')
        }
      >
        {done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-body font-medium ${done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}
        >
          {name}
        </div>
        {meta && (
          <div className="mt-0.5 flex items-center gap-2 text-caption text-text-tertiary">
            {meta}
            {installment && (
              <span className="rounded border border-border bg-bg-subtle px-1 py-0.5 text-label text-text-tertiary">
                {installment}
              </span>
            )}
          </div>
        )}
      </div>
      <span className={`shrink-0 text-body font-semibold tabular-nums ${amountCls}`}>{amount}</span>
    </div>
  )
}

/* ListFooter — totals row at the bottom */
interface ListFooterProps {
  label: ReactNode
  value: ReactNode
  className?: string
}
export function ListFooter({ label, value, className = '' }: ListFooterProps) {
  return (
    <div
      className={`flex items-center justify-between border-t border-border bg-bg-subtle px-5 py-3 ${className}`}
    >
      <span className="text-caption font-semibold text-text-secondary">{label}</span>
      <span className="text-caption font-semibold tabular-nums text-text-primary">{value}</span>
    </div>
  )
}
