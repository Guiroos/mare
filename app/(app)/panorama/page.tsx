import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getAnnualOverview,
  getAnnualExpensesByGroup,
  getAvailableYears,
} from '@/lib/queries/panorama'
import { getPatrimonyTimeline } from '@/lib/queries/investments'
import { getUserCreditMode } from '@/lib/queries/fatura'
import { getCreditAccounts } from '@/lib/queries/categories'
import { currentYearMonth, normalizeYearParam } from '@/lib/utils/date'
import { annualTotals, annualTotalsToDate } from '@/lib/utils/panorama-totals'
import { Card } from '@/components/ui/card'
import { AnnualStackedChart } from '@/components/charts/AnnualStackedChart'
import { PatrimonyEvolutionChart } from '@/components/charts/PatrimonyEvolutionChart'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { YearSelector } from '@/components/panorama/YearSelector'
import { AnnualSummaryCards } from '@/components/panorama/AnnualSummaryCards'
import { PanoramaTable } from '@/components/panorama/PanoramaTable'
import { ExportButton } from '@/components/export/ExportButton'

export default async function PanoramaPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { year: rawYear } = await searchParams
  const year = normalizeYearParam(rawYear)

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

  // Dois conjuntos, nomeados pelo período: a tabela soma a coluna (12 meses),
  // os cards são YTD. Nunca passar um no lugar do outro (#125).
  const tableTotals = annualTotals(overview)
  const ytdTotals = annualTotalsToDate(overview, currentYearMonth())

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
          <YearSelector years={years} selected={year} />
          <ExportButton
            items={[
              {
                label: 'Excel (.xlsx)',
                href: `/api/export/extrato?de=${year}-01-01&ate=${year}-12-31`,
              },
              {
                label: 'CSV',
                href: `/api/export/extrato?de=${year}-01-01&ate=${year}-12-31&format=csv`,
              },
              { label: 'PDF', soon: true },
            ]}
          />
        </div>
      </div>

      <AnnualSummaryCards prevOverview={prevOverview} year={year} totals={ytdTotals} />

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
        <PanoramaTable overview={overview} totals={tableTotals} />
      </Card>

      {/* Section 2 — Expenses by group chart */}
      <Card padding="md">
        <h2 className="mb-5 text-body font-semibold text-text-primary">Gastos por grupo</h2>
        <AnnualStackedChart data={expensesByGroup} allGroupNames={allGroupNames} />
      </Card>
    </PageLayout>
  )
}
