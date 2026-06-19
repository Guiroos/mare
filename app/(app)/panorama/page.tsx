import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'
import { auth } from '@/lib/auth'
import {
  getAnnualOverview,
  getAnnualExpensesByGroup,
  getAvailableYears,
} from '@/lib/queries/panorama'
import { getPatrimonyTimeline } from '@/lib/queries/investments'
import { getUserCreditMode } from '@/lib/queries/fatura'
import { getCreditAccounts } from '@/lib/queries/categories'
import { currentYear, currentYearMonth } from '@/lib/utils/date'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AnnualStackedChart } from '@/components/charts/AnnualStackedChart'
import { PatrimonyEvolutionChart } from '@/components/charts/PatrimonyEvolutionChart'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { YearSelector } from '@/components/panorama/YearSelector'
import { AnnualSummaryCards } from '@/components/panorama/AnnualSummaryCards'
import { PanoramaTable } from '@/components/panorama/PanoramaTable'
import { PrivacyToggle } from '@/components/providers/PrivacyMode'

export default async function PanoramaPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { year: rawYear } = await searchParams
  const parsedYear = parseInt(rawYear ?? '', 10)
  const year = isFinite(parsedYear) && parsedYear > 2000 ? parsedYear : currentYear()

  const [creditMode, creditAccounts] = await Promise.all([
    getUserCreditMode(userId),
    getCreditAccounts(userId),
  ])

  const faturaCtx =
    creditMode.creditMode === 'fatura'
      ? {
          creditMode: creditMode.creditMode as 'accrual' | 'fatura',
          faturaActiveFrom: creditMode.faturaActiveFrom,
          creditAccountIds: creditAccounts.map((a) => a.id),
        }
      : undefined

  const [overview, prevOverview, expensesByGroup, availableYears, patrimonyTimeline] =
    await Promise.all([
      getAnnualOverview(userId, year, faturaCtx),
      getAnnualOverview(userId, year - 1, faturaCtx),
      getAnnualExpensesByGroup(userId, year, faturaCtx),
      getAvailableYears(userId),
      getPatrimonyTimeline(userId),
    ])

  const nowYM = currentYearMonth()
  const activeOverview = overview.filter((m) => m.month <= nowYM)

  const totalIncomes = overview.reduce((sum, m) => sum + m.totalIncomes, 0)
  const totalExpensesYTD = activeOverview.reduce((sum, m) => sum + m.totalExpenses, 0)
  const totalInvested = overview.reduce((sum, m) => sum + m.totalInvested, 0)
  const finalBalance = totalIncomes - totalExpensesYTD - totalInvested

  const allGroupNames = Array.from(
    new Set(expensesByGroup.flatMap((m) => m.groups.map((g) => g.groupName)))
  )

  const years = availableYears.includes(year)
    ? availableYears
    : [...availableYears, year].sort((a, b) => a - b)

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Panorama Anual"
          description="Como o seu ano financeiro está se desenhando — receitas, despesas e patrimônio mês a mês."
        />
        <div className="flex flex-shrink-0 items-center gap-2">
          <PrivacyToggle />
          <YearSelector years={years} selected={year} />
          <Button variant="outline" size="sm" disabled leftIcon={<Download className="h-4 w-4" />}>
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      <AnnualSummaryCards
        overview={overview}
        prevOverview={prevOverview}
        year={year}
        totalIncomes={totalIncomes}
        totalInvested={totalInvested}
      />

      <Card padding="md">
        <PatrimonyEvolutionChart
          overview={overview}
          patrimonyTimeline={patrimonyTimeline}
          year={year}
        />
      </Card>

      {/* Section 1 — Monthly table */}
      <Card>
        <div className="px-5 py-4">
          <h2 className="text-body font-semibold text-text-primary">Tabela mensal</h2>
        </div>
        <PanoramaTable
          overview={overview}
          totalIncomes={totalIncomes}
          totalExpensesYTD={totalExpensesYTD}
          totalInvested={totalInvested}
          finalBalance={finalBalance}
        />
      </Card>

      {/* Section 2 — Expenses by group chart */}
      <Card padding="md">
        <h2 className="mb-5 text-body font-semibold text-text-primary">Gastos por grupo</h2>
        <AnnualStackedChart data={expensesByGroup} allGroupNames={allGroupNames} />
      </Card>
    </PageLayout>
  )
}
