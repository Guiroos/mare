import { ReactNode, HTMLAttributes } from 'react'
import { Check } from 'lucide-react'

/* TxList — container */
interface TxListProps extends HTMLAttributes<HTMLDivElement> { children: ReactNode }
export function TxList({ className = '', children, ...props }: TxListProps) {
  return (
    <div
      className={`bg-bg-surface border border-border rounded-lg overflow-hidden shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

/* TxGroupHeader — date row separating groups */
interface TxGroupHeaderProps { date: ReactNode; total?: ReactNode; className?: string }
export function TxGroupHeader({ date, total, className = '' }: TxGroupHeaderProps) {
  return (
    <div className={`py-3 px-5 bg-bg-subtle flex items-center justify-between border-b border-border ${className}`}>
      <span className="text-caption font-semibold text-text-secondary">{date}</span>
      {total != null && (
        <span className="text-caption font-semibold text-text-secondary tabular-nums">{total}</span>
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
  dot, dotBg, dotColor, name, meta, amount, amountTone,
  installment, onClick, strike = false, className = '',
}: TxItemProps) {
  const amountCls =
    (amountTone === 'pos' ? 'text-positive-text' : amountTone === 'neg' ? 'text-negative-text' : 'text-text-primary') +
    (strike ? ' line-through !text-text-tertiary' : '')
  const nameCls = strike ? 'line-through text-text-tertiary' : 'text-text-primary'

  return (
    <div className={`${rowBase} ${className}`} onClick={onClick}>
      {dot !== undefined && (
        <div
          className="w-9 h-9 rounded-sm shrink-0 flex items-center justify-center text-body font-semibold"
          style={{ background: dotBg, color: dotColor }}
        >
          {dot}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-body font-medium truncate ${nameCls}`}>{name}</div>
        {meta && (
          <div className="text-caption text-text-tertiary flex items-center gap-2 mt-0.5">
            {meta}
            {installment && (
              <span className="bg-bg-subtle text-text-tertiary text-label py-0.5 px-1 rounded border border-border">
                {installment}
              </span>
            )}
          </div>
        )}
      </div>
      <span className={`text-body font-semibold tabular-nums shrink-0 ${amountCls}`}>{amount}</span>
    </div>
  )
}

/* FixedExpenseItem — row with done/undone checkbox */
interface FixedExpenseItemProps extends Omit<TxItemProps, 'dot' | 'dotBg' | 'dotColor' | 'strike'> {
  done: boolean
  onToggle?: (done: boolean) => void
}

export function FixedExpenseItem({
  done, onToggle, name, meta, amount, amountTone, installment, className = '',
}: FixedExpenseItemProps) {
  const amountCls =
    (amountTone === 'pos' ? 'text-positive-text' : amountTone === 'neg' ? 'text-negative-text' : 'text-text-primary') +
    (done ? ' line-through !text-text-tertiary' : '')

  return (
    <div className={`${rowBase} ${className}`}>
      <button
        type="button"
        onClick={() => onToggle?.(!done)}
        aria-pressed={done}
        className={
          'w-5 h-5 rounded-md shrink-0 flex items-center justify-center cursor-pointer ' +
          'transition-[background,border-color] duration-fast border-2 ' +
          (done ? 'bg-positive border-positive' : 'border-border-strong bg-transparent')
        }
      >
        {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-body font-medium truncate ${done ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
          {name}
        </div>
        {meta && (
          <div className="text-caption text-text-tertiary flex items-center gap-2 mt-0.5">
            {meta}
            {installment && (
              <span className="bg-bg-subtle text-text-tertiary text-label py-0.5 px-1 rounded border border-border">
                {installment}
              </span>
            )}
          </div>
        )}
      </div>
      <span className={`text-body font-semibold tabular-nums shrink-0 ${amountCls}`}>{amount}</span>
    </div>
  )
}

/* ListFooter — totals row at the bottom */
interface ListFooterProps { label: ReactNode; value: ReactNode; className?: string }
export function ListFooter({ label, value, className = '' }: ListFooterProps) {
  return (
    <div className={`py-3 px-5 bg-bg-subtle border-t border-border flex justify-between items-center ${className}`}>
      <span className="text-caption font-semibold text-text-secondary">{label}</span>
      <span className="text-caption font-semibold text-text-primary tabular-nums">{value}</span>
    </div>
  )
}
