import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-5 w-80 animate-pulse rounded-md bg-bg-subtle" />
      </div>
      <div className="h-20 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="space-y-3">
        <div className="h-5 w-36 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-48 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-48 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-44 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </PageLayout>
  )
}
