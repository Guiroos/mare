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
import { formatCurrency } from '@/lib/utils/currency'
import { currentYear, formatMonthAbbr } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AnnualStackedChart } from '@/components/charts/AnnualStackedChart'
import { PatrimonyEvolutionChart } from '@/components/charts/PatrimonyEvolutionChart'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { YearSelector } from '@/components/panorama/YearSelector'
import { AnnualSummaryCards } from '@/components/panorama/AnnualSummaryCards'

export default async function PanoramaPage({ searchParams }: { searchParams: { year?: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  const userId = session.user.id

  const parsedYear = parseInt(searchParams.year ?? '', 10)
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

  const totalIncomes = overview.reduce((sum, m) => sum + m.totalIncomes, 0)
  const totalExpenses = overview.reduce((sum, m) => sum + m.totalExpenses, 0)
  const totalInvested = overview.reduce((sum, m) => sum + m.totalInvested, 0)
  const finalBalance = totalIncomes - totalExpenses - totalInvested

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
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b bg-bg-muted">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Mês</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Entradas</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Gastos</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">
                  Investimentos
                </th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => {
                const monthLabel = formatMonthAbbr(row.month).toUpperCase()
                return (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-bg-muted">
                    <td className="px-4 py-3 font-medium">{monthLabel}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-positive-text">
                      {formatCurrency(row.totalIncomes)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-negative-text">
                      {formatCurrency(row.totalExpenses)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-accent-text">
                      {formatCurrency(row.totalInvested)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-medium tabular-nums',
                        row.balance >= 0 ? 'text-positive-text' : 'text-negative-text'
                      )}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-bg-muted font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-positive-text">
                  {formatCurrency(totalIncomes)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-negative-text">
                  {formatCurrency(totalExpenses)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-accent-text">
                  {formatCurrency(totalInvested)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    finalBalance >= 0 ? 'text-positive-text' : 'text-negative-text'
                  )}
                >
                  {formatCurrency(finalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="divide-y md:hidden">
          {overview.map((row) => {
            const monthLabel = formatMonthAbbr(row.month).toUpperCase()
            return (
              <div key={row.month} className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-small font-semibold">{monthLabel}</span>
                  <span
                    className={cn(
                      'text-small font-medium tabular-nums',
                      row.balance >= 0 ? 'text-positive-text' : 'text-negative-text'
                    )}
                  >
                    {formatCurrency(row.balance)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-caption text-text-secondary">
                  <div>
                    <span className="block">Entradas</span>
                    <span className="font-medium tabular-nums text-positive-text">
                      {formatCurrency(row.totalIncomes)}
                    </span>
                  </div>
                  <div>
                    <span className="block">Gastos</span>
                    <span className="font-medium tabular-nums text-negative-text">
                      {formatCurrency(row.totalExpenses)}
                    </span>
                  </div>
                  <div>
                    <span className="block">Investido</span>
                    <span className="font-medium tabular-nums text-accent-text">
                      {formatCurrency(row.totalInvested)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {/* Summary row on mobile */}
          <div className="bg-bg-muted px-4 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-small font-bold">Total</span>
              <span
                className={cn(
                  'text-small font-bold tabular-nums',
                  finalBalance >= 0 ? 'text-positive-text' : 'text-negative-text'
                )}
              >
                {formatCurrency(finalBalance)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-caption text-text-secondary">
              <div>
                <span className="block">Entradas</span>
                <span className="font-semibold tabular-nums text-positive-text">
                  {formatCurrency(totalIncomes)}
                </span>
              </div>
              <div>
                <span className="block">Gastos</span>
                <span className="font-semibold tabular-nums text-negative-text">
                  {formatCurrency(totalExpenses)}
                </span>
              </div>
              <div>
                <span className="block">Investido</span>
                <span className="font-semibold tabular-nums text-accent-text">
                  {formatCurrency(totalInvested)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2 — Expenses by group chart */}
      <Card padding="md">
        <h2 className="mb-5 text-body font-semibold text-text-primary">Gastos por grupo</h2>
        <AnnualStackedChart data={expensesByGroup} allGroupNames={allGroupNames} />
      </Card>
    </PageLayout>
  )
}
