import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDashboardData, getDashboardDataBillingCycle } from '@/lib/queries/dashboard'
import { getCreditClosingDays } from '@/lib/queries/categories'
import { formatCurrency } from '@/lib/utils/currency'
import {
  currentYearMonth,
  yearMonthToReferenceMonth,
  todayParts,
  billingCycleDateRange,
} from '@/lib/utils/date'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { CategoryGroupProgress } from '@/components/dashboard/CategoryGroupProgress'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList'
import { IncomeList } from '@/components/dashboard/IncomeList'
import { DashboardFAB } from '@/components/dashboard/DashboardFAB'
import { InvestmentList } from '@/components/dashboard/InvestmentList'
import { PendencyBanner } from '@/components/dashboard/PendencyBanner'
import { PageLayout } from '@/components/ui/page-layout'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; view?: string; closingDay?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = (session.user as { id: string }).id
  const month = searchParams.month ?? currentYearMonth()
  const referenceMonth = yearMonthToReferenceMonth(month)

  const creditClosingDays = await getCreditClosingDays(userId)
  const hasBillingCycle = creditClosingDays.length > 0

  // Resolve active closing day (from URL param or first available)
  const urlClosingDay = searchParams.closingDay ? parseInt(searchParams.closingDay, 10) : null
  const activeClosingDay =
    hasBillingCycle && searchParams.view === 'cycle'
      ? (urlClosingDay ?? creditClosingDays[0])
      : null

  const cycleRange = activeClosingDay ? billingCycleDateRange(month, activeClosingDay) : null
  const isCycleView = cycleRange !== null

  const data = isCycleView
    ? await getDashboardDataBillingCycle(userId, month, activeClosingDay!, cycleRange)
    : await getDashboardData(userId, referenceMonth)

  const { day: todayDay, year: currentYear, month: currentMonth } = todayParts()
  const [displayYear, displayMonth] = month.split('-').map(Number)
  const isCurrentMonth = month === currentYearMonth()
  const isPastMonth =
    displayYear < currentYear || (displayYear === currentYear && displayMonth < currentMonth)

  const unpaidFixedCount = isCurrentMonth ? data.fixedExpenses.filter((e) => !e.paid).length : 0
  const pendingYieldCount = isCurrentMonth
    ? data.investments.filter((i) => i.amount !== null && i.yieldAmount === null).length
    : 0

  const pendingFixed = data.fixedExpenses.filter((e) => !e.paid).length
  const totalTransactions = data.transactions.length
  const totalIncomes = data.summary.totalIncomes
  const totalInvested = data.summary.totalInvested

  return (
    <PageLayout>
      <MonthSelector
        currentMonth={month}
        isCurrentMonth={isCurrentMonth}
        isCycleView={isCycleView}
        cycleRange={cycleRange ?? undefined}
        availableClosingDays={creditClosingDays}
        activeClosingDay={activeClosingDay ?? undefined}
      />

      <PendencyBanner unpaidFixedCount={unpaidFixedCount} pendingYieldCount={pendingYieldCount} />

      <SummaryCards summary={data.summary} />

      {/* Row 1: Orçamento + Gastos Fixos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Orçamento por categoria">
          <CategoryGroupProgress
            groups={data.groupProgress}
            transactions={data.transactions}
            fixedExpenses={data.fixedExpenses}
          />
        </Section>

        <Section
          title="Gastos fixos"
          count={
            pendingFixed > 0 ? `${pendingFixed} pendente${pendingFixed > 1 ? 's' : ''}` : undefined
          }
        >
          <FixedExpenseList
            expenses={data.fixedExpenses}
            yearMonth={month}
            isCurrentMonth={isCurrentMonth}
            isPastMonth={isPastMonth}
            todayDay={todayDay}
          />
        </Section>
      </div>

      {/* Transações — full width */}
      <Section
        title="Transações"
        count={totalTransactions > 0 ? `${totalTransactions} este mês` : undefined}
      >
        <TransactionList transactions={data.transactions} />
      </Section>

      {/* Row 2: Entradas + Investimentos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="Entradas"
          count={totalIncomes > 0 ? formatCurrency(totalIncomes) : undefined}
          countVariant="positive"
        >
          <IncomeList incomes={data.incomes} />
        </Section>

        <Section
          title="Investimentos"
          count={totalInvested > 0 ? formatCurrency(totalInvested) : undefined}
        >
          <InvestmentList investments={data.investments} />
        </Section>
      </div>

      <DashboardFAB month={month} />
    </PageLayout>
  )
}

function Section({
  title,
  children,
  count,
  countVariant = 'default',
}: {
  title: string
  children: React.ReactNode
  count?: string
  countVariant?: 'default' | 'positive'
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-label font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </h2>
        {count && (
          <span
            className={
              countVariant === 'positive'
                ? 'rounded-full border border-positive bg-positive-subtle px-2 py-0.5 text-label text-positive-text'
                : 'rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-label text-text-secondary'
            }
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
