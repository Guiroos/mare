import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  boxed?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  boxed = false,
  className = '',
}: EmptyStateProps) {
  const body = (
    <div
      className={`flex flex-col items-center justify-center gap-4 px-8 py-12 text-center ${className}`}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-bg-subtle [&>svg]:h-7 [&>svg]:w-7 [&>svg]:text-text-tertiary">
          {icon}
        </div>
      )}
      <span className="text-body-lg font-semibold text-text-primary">{title}</span>
      {description && (
        <span className="max-w-56 text-pretty text-small text-text-tertiary">{description}</span>
      )}
      {action}
    </div>
  )

  if (boxed) {
    return <div className="rounded-lg border border-border bg-bg-surface shadow-sm">{body}</div>
  }

  return body
}
