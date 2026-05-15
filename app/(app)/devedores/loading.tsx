import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-bg-subtle" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-bg-subtle" />
        ))}
      </div>
    </PageLayout>
  )
}
