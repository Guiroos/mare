import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  boxed?: boolean
  className?: string
}

export function EmptyState({ icon, title, description, action, boxed = false, className = '' }: EmptyStateProps) {
  const body = (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 px-8 text-center ${className}`}>
      {icon && (
        <div className="w-14 h-14 bg-bg-subtle rounded-lg flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7 [&>svg]:text-text-tertiary">
          {icon}
        </div>
      )}
      <span className="text-body-lg font-semibold text-text-primary">{title}</span>
      {description && (
        <span className="text-small text-text-tertiary max-w-56 text-pretty">{description}</span>
      )}
      {action}
    </div>
  )

  if (boxed) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg shadow-sm">{body}</div>
    )
  }

  return body
}
