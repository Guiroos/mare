import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout>
      {/* MonthSelector */}
      <div className="h-9 w-40 animate-pulse rounded-full bg-bg-subtle" />
      {/* SummaryCards */}
      <div className="h-36 animate-pulse rounded-xl bg-bg-subtle" />
      {/* Row 1: Orçamento + Gastos Fixos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-48 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
      {/* Row 2: Transações + Entradas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </PageLayout>
  )
}
