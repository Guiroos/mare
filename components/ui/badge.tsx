import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export type BadgeVariant = 'positive' | 'negative' | 'accent' | 'warning' | 'muted'
export type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: string
  children: ReactNode
}

const variants: Record<BadgeVariant, string> = {
  positive: 'bg-positive-subtle text-positive-text',
  negative: 'bg-negative-subtle text-negative-text',
  accent: 'bg-accent-subtle text-accent-text',
  warning: 'bg-warning-subtle text-warning-text',
  muted: 'bg-bg-subtle text-text-tertiary border border-border',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'text-label py-0.5 px-2',
  md: 'text-caption py-1 px-2.5',
  lg: 'text-small py-1 px-3',
}

export function Badge({
  variant = 'muted',
  size = 'md',
  dot,
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        sizes[size],
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  )
}
