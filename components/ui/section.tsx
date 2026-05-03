export function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
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
