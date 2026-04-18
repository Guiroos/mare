import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAnnualOverview, getAnnualExpensesByGroup } from '@/lib/queries/panorama';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnualStackedChart } from '@/components/charts/AnnualStackedChart';

export default async function PanoramaPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const userId = (session.user as any).id as string;

  const year = new Date().getFullYear();

  const [overview, expensesByGroup] = await Promise.all([
    getAnnualOverview(userId, year),
    getAnnualExpensesByGroup(userId, year),
  ]);

  const totalIncomes = overview.reduce((sum, m) => sum + m.totalIncomes, 0);
  const totalExpenses = overview.reduce((sum, m) => sum + m.totalExpenses, 0);
  const totalInvested = overview.reduce((sum, m) => sum + m.totalInvested, 0);
  const finalBalance = totalIncomes - totalExpenses - totalInvested;

  const allGroupNames = Array.from(
    new Set(expensesByGroup.flatMap((m) => m.groups.map((g) => g.groupName)))
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Panorama Anual</h1>
        <p className="text-muted-foreground text-sm">{year}</p>
      </div>

      {/* Section 1 — Monthly table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabela mensal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mês</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Entradas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gastos</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Investimentos</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((row) => {
                  const [y, m] = row.month.split('-').map(Number);
                  const monthLabel = new Date(y, m - 1, 1)
                    .toLocaleDateString('pt-BR', { month: 'short' })
                    .toUpperCase();
                  return (
                    <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30">
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
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50 font-semibold">
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
          <div className="md:hidden divide-y">
            {overview.map((row) => {
              const [y, m] = row.month.split('-').map(Number);
              const monthLabel = new Date(y, m - 1, 1)
                .toLocaleDateString('pt-BR', { month: 'short' })
                .toUpperCase();
              return (
                <div key={row.month} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{monthLabel}</span>
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
                      <span className="text-green-600 font-medium">
                        {formatCurrency(row.totalIncomes)}
                      </span>
                    </div>
                    <div>
                      <span className="block">Gastos</span>
                      <span className="text-red-500 font-medium">
                        {formatCurrency(row.totalExpenses)}
                      </span>
                    </div>
                    <div>
                      <span className="block">Investido</span>
                      <span className="text-blue-600 font-medium">
                        {formatCurrency(row.totalInvested)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Summary row on mobile */}
            <div className="px-4 py-3 bg-muted/50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">Total</span>
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
                  <span className="text-green-600 font-semibold">
                    {formatCurrency(totalIncomes)}
                  </span>
                </div>
                <div>
                  <span className="block">Gastos</span>
                  <span className="text-red-500 font-semibold">
                    {formatCurrency(totalExpenses)}
                  </span>
                </div>
                <div>
                  <span className="block">Investido</span>
                  <span className="text-blue-600 font-semibold">
                    {formatCurrency(totalInvested)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Expenses by group chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gastos por grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnualStackedChart data={expensesByGroup} allGroupNames={allGroupNames} />
        </CardContent>
      </Card>
    </div>
  );
}
