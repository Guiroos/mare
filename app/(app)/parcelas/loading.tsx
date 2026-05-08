import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-bg-subtle" />
      </div>

      {/* Desktop KPI strip */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
      </div>

      {/* Mobile hero */}
      <div className="h-40 animate-pulse rounded-xl bg-bg-subtle lg:hidden" />

      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="h-8 w-20 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-bg-subtle" />
      </div>

      {/* Installment cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-36 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-36 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-36 animate-pulse rounded-xl bg-bg-subtle" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </PageLayout>
  )
}
