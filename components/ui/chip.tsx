import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?:   boolean
  leftIcon?: ReactNode
  children?: ReactNode
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, leftIcon, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={
        'inline-flex items-center gap-2 py-1.5 px-3 rounded-full text-small font-medium font-sans cursor-pointer ' +
        'border-2 transition-[background,border-color,color] duration-fast ' +
        (active
          ? 'border-accent bg-accent-subtle text-accent-text'
          : 'border-border bg-bg-surface text-text-secondary hover:border-border-strong') +
        ' ' + className
      }
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  ),
)
Chip.displayName = 'Chip'
