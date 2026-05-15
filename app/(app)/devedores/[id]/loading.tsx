import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-5 w-40 animate-pulse rounded-md bg-bg-subtle" />
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-subtle" />
        ))}
      </div>
    </PageLayout>
  )
}
