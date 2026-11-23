import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type DashboardLink = {
  label: string
  value: React.ReactNode
  href: string
}

export function DashboardLinks({ links }: { links: DashboardLink[] }) {
  return (
    <nav aria-label="Mais do mês" className="grid grid-cols-2 gap-3 pt-1 lg:grid-cols-4">
      {links.map((l) => (
        <Link
          key={l.label}
          href={l.href}
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-surface px-4 py-3 transition duration-base hover:border-border-strong hover:shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-small font-semibold text-text-primary">{l.label}</p>
            <p className="truncate text-caption tabular-nums text-text-tertiary">{l.value}</p>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
        </Link>
      ))}
    </nav>
  )
}
