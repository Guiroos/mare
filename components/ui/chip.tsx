import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  leftIcon?: ReactNode
  children?: ReactNode
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, leftIcon, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={
        'inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 font-sans text-small font-medium ' +
        'border-2 transition-[background,border-color,color] duration-fast ' +
        (active
          ? 'border-accent bg-accent-subtle text-accent-text'
          : 'border-border bg-bg-surface text-text-secondary hover:border-border-strong') +
        ' ' +
        className
      }
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  )
)
Chip.displayName = 'Chip'
