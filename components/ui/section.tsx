import { cn } from '@/lib/utils/cn'

const titleSizes = {
  sm: 'text-label uppercase text-text-secondary',
  lg: 'text-h3 text-text-primary',
}

export function Section({
  title,
  children,
  action,
  badge,
  size = 'sm',
  id,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  /** Renderizado colado ao título (ex: contagem), à esquerda da `action`. */
  badge?: React.ReactNode
  size?: keyof typeof titleSizes
  id?: string
  className?: string
}) {
  return (
    <section id={id} className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className={titleSizes[size]}>{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
