import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDashboardData, getDashboardDataBillingCycle } from '@/lib/queries/dashboard'
import { getCreditAccounts, getPaymentAccounts } from '@/lib/queries/categories'
import { getUserCreditMode, getOpenFaturas } from '@/lib/queries/fatura'
import { getMaturityAlerts } from '@/lib/queries/investments'
import {
  currentYearMonth,
  yearMonthToReferenceMonth,
  todayParts,
  billingCycleDateRange,
} from '@/lib/utils/date'
import { MaturityAlerts } from '@/components/dashboard/MaturityAlerts'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { CategoryGroupProgress } from '@/components/dashboard/CategoryGroupProgress'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList'
import { IncomeList } from '@/components/dashboard/IncomeList'
import { InvestmentList } from '@/components/dashboard/InvestmentList'
import { PendencyBanner } from '@/components/dashboard/PendencyBanner'
import { FaturaCard } from '@/components/fatura/FaturaCard'
import { PageLayout } from '@/components/ui/page-layout'
import { Section } from '@/components/ui/section'
import { Badge } from '@/components/ui/badge'
import { DashboardFAB } from '@/components/dashboard/DashboardFAB'
import { PrivacyToggle, SensitiveMoneyBadge } from '@/components/providers/PrivacyMode'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cycleAccount?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const { month: rawMonth, cycleAccount } = await searchParams
  const month = rawMonth ?? currentYearMonth()
  const referenceMonth = yearMonthToReferenceMonth(month)

  const [creditAccounts, creditMode] = await Promise.all([
    getCreditAccounts(userId),
    getUserCreditMode(userId),
  ])
  const activeAccount = creditAccounts.find((a) => a.id === cycleAccount) ?? null

  const cycleRange = activeAccount ? billingCycleDateRange(month, activeAccount.closingDay) : null
  const isCycleView = cycleRange !== null
  const isFaturaMode = !isCycleView && creditMode.creditMode === 'fatura'

  const faturaCtx = isFaturaMode
    ? {
        creditMode: creditMode.creditMode as 'accrual' | 'fatura',
        faturaActiveFrom: creditMode.faturaActiveFrom,
        creditAccountIds: creditAccounts.map((a) => a.id),
      }
    : undefined

  const [data, openFaturas, allAccounts, maturityAlerts] = await Promise.all([
    isCycleView
      ? getDashboardDataBillingCycle(
          userId,
          month,
          activeAccount!.closingDay,
          cycleRange,
          activeAccount!.id
        )
      : getDashboardData(userId, referenceMonth, faturaCtx),
    isFaturaMode ? getOpenFaturas(userId, creditMode.faturaActiveFrom) : Promise.resolve([]),
    isFaturaMode ? getPaymentAccounts(userId) : Promise.resolve([]),
    getMaturityAlerts(userId),
  ])

  const maturityInvestmentTypes = maturityAlerts.map((a) => ({ id: a.id, name: a.name }))

  const debitAccounts = allAccounts.filter((a) => a.type !== 'credit')
  const unconfiguredCreditAccounts = isFaturaMode
    ? allAccounts.filter((a) => a.type === 'credit' && (a.closingDay == null || a.closingDay <= 1))
    : []

  const { day: todayDay, year: currentYear, month: currentMonth } = todayParts()
  const [displayYear, displayMonth] = month.split('-').map(Number)
  const isCurrentMonth = month === currentYearMonth()
  const isPastMonth =
    displayYear < currentYear || (displayYear === currentYear && displayMonth < currentMonth)

  const accountOptions = [
    ...new Map(
      data.transactions
        .filter((t) => t.account)
        .map((t) => [t.accountId, { value: t.accountId!, label: t.account!.name }])
    ).values(),
  ]

  const creditIdSet = new Set(faturaCtx?.creditAccountIds ?? [])
  const fixedForPendency =
    faturaCtx && creditIdSet.size > 0
      ? data.fixedExpenses.filter((e) => !creditIdSet.has(e.accountId))
      : data.fixedExpenses
  const pendingFixed = fixedForPendency.filter((e) => !e.paid).length
  const unpaidFixedCount = isCurrentMonth ? pendingFixed : 0
  const pendingYieldCount = isCurrentMonth
    ? data.investments.filter((i) => i.amount !== null && i.yieldAmount === null).length
    : 0
  const totalTransactions = data.transactions.length
  const totalIncomes = data.summary.totalIncomes
  const totalInvested = data.summary.totalInvested

  return (
    <PageLayout>
      <MonthSelector
        currentMonth={month}
        isCurrentMonth={isCurrentMonth}
        cycleRange={cycleRange ?? undefined}
        creditAccounts={creditAccounts}
        activeCycleAccountId={activeAccount?.id}
        action={
          <div className="flex items-center gap-1">
            <PrivacyToggle />
            <DashboardFAB month={month} />
          </div>
        }
      />

      <PendencyBanner unpaidFixedCount={unpaidFixedCount} pendingYieldCount={pendingYieldCount} />

      <SummaryCards summary={data.summary} />

      {(openFaturas.length > 0 || unconfiguredCreditAccounts.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {openFaturas.map((fatura) => (
            <FaturaCard key={fatura.account.id} data={fatura} debitAccounts={debitAccounts} />
          ))}
          {unconfiguredCreditAccounts.map((account) => (
            <div
              key={account.id}
              className="relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-bg-surface p-5 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:rounded-t-lg before:bg-warning before:content-['']"
            >
              <span className="text-caption font-medium text-text-secondary">{account.name}</span>
              <p className="text-small text-text-secondary">
                Configure o dia de fechamento deste cartão em{' '}
                <Link href="/contas" className="font-medium text-accent-text hover:underline">
                  Contas
                </Link>{' '}
                para incluí-lo no regime de fatura.
              </p>
            </div>
          ))}
        </div>
      )}

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
          action={
            pendingFixed > 0 ? (
              <Badge variant="muted" size="sm">
                {pendingFixed} pendente{pendingFixed > 1 ? 's' : ''}
              </Badge>
            ) : undefined
          }
        >
          <FixedExpenseList
            expenses={data.fixedExpenses}
            yearMonth={month}
            isCurrentMonth={isCurrentMonth}
            isPastMonth={isPastMonth}
            todayDay={todayDay}
            creditAccountIds={isFaturaMode ? faturaCtx?.creditAccountIds : undefined}
          />
        </Section>
      </div>

      {/* Transações — full width */}
      <Section
        title="Transações"
        action={
          totalTransactions > 0 ? (
            <Badge variant="muted" size="sm">
              {totalTransactions} este mês
            </Badge>
          ) : undefined
        }
      >
        <TransactionList
          transactions={data.transactions}
          creditAccountIds={isFaturaMode ? faturaCtx?.creditAccountIds : undefined}
          accountOptions={accountOptions}
          yearMonth={month}
        />
      </Section>

      {/* Vencimentos próximos */}
      {maturityAlerts.length > 0 && (
        <Section title="Vencimentos próximos">
          <MaturityAlerts alerts={maturityAlerts} investmentTypes={maturityInvestmentTypes} />
        </Section>
      )}

      {/* Row 2: Entradas + Investimentos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="Entradas"
          action={<SensitiveMoneyBadge value={totalIncomes} variant="positive" />}
        >
          <IncomeList incomes={data.incomes} />
        </Section>

        <Section
          title="Investimentos"
          action={<SensitiveMoneyBadge value={totalInvested} variant="muted" />}
        >
          <InvestmentList investments={data.investments} />
        </Section>
      </div>
    </PageLayout>
  )
}
