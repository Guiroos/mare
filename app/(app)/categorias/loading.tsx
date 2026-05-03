import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-bg-subtle" />
      </div>
      <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" />
    </PageLayout>
  )
}
