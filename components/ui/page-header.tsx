export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-h1">{title}</h1>
      {description && <p className="mt-1 text-body text-text-secondary">{description}</p>}
    </div>
  )
}
