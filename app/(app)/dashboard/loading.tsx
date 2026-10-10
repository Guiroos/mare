import { PageLayout } from '@/components/ui/page-layout'

export default function Loading() {
  return (
    <PageLayout className="space-y-5 lg:space-y-6">
      {/* MonthSelector */}
      <div className="h-9 w-40 animate-pulse rounded-full bg-bg-subtle" />
      {/* BalanceHero */}
      <div className="h-44 animate-pulse rounded-xl bg-bg-subtle" />
      {/* PendencyBanner */}
      <div className="h-11 animate-pulse rounded-lg bg-bg-subtle" />
      {/* Últimas transações + Faturas/Gastos fixos */}
      <div className="grid grid-cols-1 items-start gap-5 lg:gap-6 xl:grid-cols-5">
        <div className="order-last h-96 animate-pulse rounded-lg bg-bg-subtle xl:order-none xl:col-span-3" />
        <div className="h-64 animate-pulse rounded-lg bg-bg-subtle xl:col-span-2" />
      </div>
    </PageLayout>
  )
}
