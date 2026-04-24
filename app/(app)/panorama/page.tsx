import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAnnualOverview, getAnnualExpensesByGroup } from '@/lib/queries/panorama'
import { formatCurrency } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { AnnualStackedChart } from '@/components/charts/AnnualStackedChart'

export default async function PanoramaPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const userId = (session.user as { id: string }).id

  const year = new Date().getFullYear()

  const [overview, expensesByGroup] = await Promise.all([
    getAnnualOverview(userId, year),
    getAnnualExpensesByGroup(userId, year),
  ])

  const totalIncomes = overview.reduce((sum, m) => sum + m.totalIncomes, 0)
  const totalExpenses = overview.reduce((sum, m) => sum + m.totalExpenses, 0)
  const totalInvested = overview.reduce((sum, m) => sum + m.totalInvested, 0)
  const finalBalance = totalIncomes - totalExpenses - totalInvested

  const allGroupNames = Array.from(
    new Set(expensesByGroup.flatMap((m) => m.groups.map((g) => g.groupName)))
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Panorama Anual</h1>
        <p className="text-sm text-muted-foreground">{year}</p>
      </div>

      {/* Section 1 — Monthly table */}
      <Card>
        <div className="px-5 py-4">
          <h2 className="text-body font-semibold text-text-primary">Tabela mensal</h2>
        </div>
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mês</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Entradas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gastos</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Investimentos
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => {
                const [y, m] = row.month.split('-').map(Number)
                const monthLabel = new Date(y, m - 1, 1)
                  .toLocaleDateString('pt-BR', { month: 'short' })
                  .toUpperCase()
                return (
                  <tr key={row.month} className="hover:bg-muted/30 border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{monthLabel}</td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(row.totalIncomes)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500">
                      {formatCurrency(row.totalExpenses)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {formatCurrency(row.totalInvested)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        row.balance >= 0 ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 border-t font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right text-green-600">
                  {formatCurrency(totalIncomes)}
                </td>
                <td className="px-4 py-3 text-right text-red-500">
                  {formatCurrency(totalExpenses)}
                </td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {formatCurrency(totalInvested)}
                </td>
                <td
                  className={`px-4 py-3 text-right ${
                    finalBalance >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
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
            const [y, m] = row.month.split('-').map(Number)
            const monthLabel = new Date(y, m - 1, 1)
              .toLocaleDateString('pt-BR', { month: 'short' })
              .toUpperCase()
            return (
              <div key={row.month} className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{monthLabel}</span>
                  <span
                    className={`text-sm font-medium ${
                      row.balance >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {formatCurrency(row.balance)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                  <div>
                    <span className="block">Entradas</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(row.totalIncomes)}
                    </span>
                  </div>
                  <div>
                    <span className="block">Gastos</span>
                    <span className="font-medium text-red-500">
                      {formatCurrency(row.totalExpenses)}
                    </span>
                  </div>
                  <div>
                    <span className="block">Investido</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(row.totalInvested)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {/* Summary row on mobile */}
          <div className="bg-muted/50 px-4 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold">Total</span>
              <span
                className={`text-sm font-bold ${
                  finalBalance >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {formatCurrency(finalBalance)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
              <div>
                <span className="block">Entradas</span>
                <span className="font-semibold text-green-600">{formatCurrency(totalIncomes)}</span>
              </div>
              <div>
                <span className="block">Gastos</span>
                <span className="font-semibold text-red-500">{formatCurrency(totalExpenses)}</span>
              </div>
              <div>
                <span className="block">Investido</span>
                <span className="font-semibold text-blue-600">{formatCurrency(totalInvested)}</span>
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
    </div>
  )
}
