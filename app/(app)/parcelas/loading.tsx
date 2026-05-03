import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-bg-subtle" />
      </div>
      {/* Stat cards */}
      <div className="flex gap-4">
        <div className="h-20 flex-1 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-20 flex-1 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
      {/* Installment cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-56 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </PageLayout>
  )
}
