import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDashboardData, getDashboardDataBillingCycle } from '@/lib/queries/dashboard'
import { getCreditAccounts, getPaymentAccounts } from '@/lib/queries/categories'
import { getUserCreditMode, getOpenFaturas } from '@/lib/queries/fatura'
import {
  currentYearMonth,
  normalizeYearMonthParam,
  yearMonthToReferenceMonth,
  todayParts,
  billingCycleDateRange,
  lastDayOfYearMonth,
  formatMonthName,
} from '@/lib/utils/date'
import { ALL_TIPOS, buildHistoricoUrl, type TipoKind } from '@/lib/utils/historico-params'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { BalanceHero } from '@/components/dashboard/BalanceHero'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList'
import { PendencyBanner } from '@/components/dashboard/PendencyBanner'
import { DashboardLinks } from '@/components/dashboard/DashboardLinks'
import { FaturaCard } from '@/components/fatura/FaturaCard'
import { PageLayout } from '@/components/ui/page-layout'
import { Section } from '@/components/ui/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardFAB } from '@/components/dashboard/DashboardFAB'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { ExportButton } from '@/components/export/ExportButton'

const sectionLinkCls = 'text-small font-semibold text-accent-text hover:underline'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cycleAccount?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const { month: rawMonth, cycleAccount } = await searchParams
  const month = normalizeYearMonthParam(rawMonth)
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

  const [data, openFaturas, allAccounts] = await Promise.all([
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
  ])

  const debitAccounts = allAccounts.filter((a) => a.type !== 'credit')
  const unconfiguredCreditAccounts = isFaturaMode
    ? allAccounts.filter((a) => a.type === 'credit' && (a.closingDay == null || a.closingDay <= 1))
    : []

  const { day: todayDay } = todayParts()
  const isCurrentMonth = month === currentYearMonth()
  const lastDay = lastDayOfYearMonth(month)
  // "outubro de 2026" → "outubro": o ano já está no seletor logo acima.
  const monthName = formatMonthName(month).split(' de ')[0]

  // Em visão de ciclo de fatura a tela mostra o ciclo, não o mês de calendário —
  // o recorte exportado (e os links para o Histórico) têm de seguir a tela.
  const range = cycleRange
    ? { de: cycleRange.start, ate: cycleRange.end }
    : { de: `${month}-01`, ate: lastDay }
  const historicoUrl = (tipos: TipoKind[] = [...ALL_TIPOS]) =>
    buildHistoricoUrl({ ...range, tipos, categorias: [], contas: [], q: '', cursor: null })

  // Contas "via fatura" neste mês — derivado do predicado que getDashboardData já
  // aplicou (mês >= faturaActiveFrom), nunca de isFaturaMode (modo do usuário).
  const viaFaturaAccountIds = data.creditFilteredFromBudget
    ? faturaCtx?.creditAccountIds
    : undefined
  const viaFaturaIdSet = new Set(viaFaturaAccountIds ?? [])
  const fixedForPendency = data.fixedExpenses.filter((e) => !viaFaturaIdSet.has(e.accountId))
  const pendingFixed = fixedForPendency.filter((e) => !e.paid).length
  const paidFixed = fixedForPendency.length - pendingFixed
  const unpaidFixedCount = isCurrentMonth ? pendingFixed : 0
  const pendingYieldCount = isCurrentMonth
    ? data.investments.filter((i) => i.amount !== null && i.yieldAmount === null).length
    : 0

  const { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent } =
    data.summary
  const feedCount = data.transactions.length + data.incomes.length
  const hasFaturas = openFaturas.length > 0 || unconfiguredCreditAccounts.length > 0
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null

  return (
    <PageLayout className="space-y-5 lg:space-y-6">
      <MonthSelector
        currentMonth={month}
        isCurrentMonth={isCurrentMonth}
        cycleRange={cycleRange ?? undefined}
        creditAccounts={creditAccounts}
        activeCycleAccountId={activeAccount?.id}
        action={
          <div className="flex items-center gap-2">
            <ExportButton
              items={[
                {
                  label: 'Excel (.xlsx)',
                  href: `/api/export/extrato?de=${range.de}&ate=${range.ate}`,
                },
                {
                  label: 'CSV',
                  href: `/api/export/extrato?de=${range.de}&ate=${range.ate}&format=csv`,
                },
                { label: 'PDF', soon: true },
              ]}
            />
            <DashboardFAB month={month} />
          </div>
        }
      />

      <BalanceHero
        label={isCycleView ? 'Saldo do ciclo' : `Saldo de ${monthName}`}
        totalIncomes={totalIncomes}
        // Investido entra em "Saídas" para que entradas − saídas feche com o saldo,
        // que já desconta o aporte do mês.
        totalOutflows={totalExpenses + totalInvested}
        balance={balance}
        daysLeft={isCurrentMonth && !isCycleView ? Number(lastDay.slice(8)) - todayDay : null}
      />

      <PendencyBanner unpaidFixedCount={unpaidFixedCount} pendingYieldCount={pendingYieldCount} />

      <div className="grid grid-cols-1 items-start gap-5 lg:gap-6 xl:grid-cols-5">
        <Section
          title="Últimas transações"
          size="lg"
          className="order-last min-w-0 xl:order-none xl:col-span-3"
          badge={
            feedCount > 0 ? (
              <Badge variant="muted" size="sm" className="tabular-nums">
                {feedCount} este mês
              </Badge>
            ) : undefined
          }
        >
          <TransactionList
            transactions={data.transactions}
            incomes={data.incomes}
            creditAccountIds={viaFaturaAccountIds}
            month={month}
            monthName={monthName}
          />
        </Section>

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6 xl:col-span-2">
          {hasFaturas && (
            <Section
              title="Faturas"
              size="lg"
              action={
                <Link href="/contas" className={sectionLinkCls}>
                  Cartões
                </Link>
              }
            >
              <div className="flex flex-col gap-3">
                {openFaturas.map((fatura) => (
                  <FaturaCard key={fatura.account.id} data={fatura} debitAccounts={debitAccounts} />
                ))}
                {unconfiguredCreditAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-bg-surface p-5 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:rounded-t-lg before:bg-warning before:content-['']"
                  >
                    <span className="text-caption font-medium text-text-secondary">
                      {account.name}
                    </span>
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
            </Section>
          )}

          <Section
            id="gastos-fixos"
            title="Gastos fixos"
            size="lg"
            className="scroll-mt-6"
            badge={
              pendingFixed > 0 ? (
                <Badge variant="muted" size="sm" className="tabular-nums">
                  {pendingFixed} pendente{pendingFixed > 1 ? 's' : ''}
                </Badge>
              ) : undefined
            }
            action={
              fixedForPendency.length > 0 ? (
                <span className="text-caption tabular-nums text-text-tertiary">
                  {paidFixed} de {fixedForPendency.length} pagos
                </span>
              ) : undefined
            }
          >
            <FixedExpenseList
              expenses={data.fixedExpenses}
              isCurrentMonth={isCurrentMonth}
              todayDay={todayDay}
              creditAccountIds={viaFaturaAccountIds}
              emptyAction={
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/configuracao-mes?month=${month}`}>Configurar gastos fixos</Link>
                </Button>
              }
            />
          </Section>
        </div>
      </div>

      <DashboardLinks
        links={[
          {
            label: 'Orçamento',
            value:
              budgetPct === null ? (
                'Sem orçamento'
              ) : (
                <span className={budgetPct > 100 ? 'font-semibold text-negative' : undefined}>
                  {budgetPct}% usado
                </span>
              ),
            href: `/configuracao-mes?month=${month}`,
          },
          {
            label: 'Entradas',
            value: <SensitiveAmount value={totalIncomes} />,
            href: historicoUrl(['entrada']),
          },
          {
            label: 'Investimentos',
            value: <SensitiveAmount value={totalInvested} />,
            href: '/investimentos',
          },
          {
            label: 'Histórico',
            // Sem contagem: o Histórico filtra pela data da compra e o dashboard pelo mês de
            // referência — parcela de cartão com fechamento cai em meses diferentes (#203).
            value: 'Todas as movimentações',
            href: historicoUrl(),
          },
        ]}
      />
    </PageLayout>
  )
}
