export function Section({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-3${className ? ` ${className}` : ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-label font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}
