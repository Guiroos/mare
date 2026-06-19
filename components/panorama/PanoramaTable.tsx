'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { cn } from '@/lib/utils/cn'
import { formatMonthAbbr } from '@/lib/utils/date'

type MonthRow = {
  month: string
  totalIncomes: number
  totalExpenses: number
  totalInvested: number
  balance: number
}

export function PanoramaTable({
  overview,
  totalIncomes,
  totalExpensesYTD,
  totalInvested,
  finalBalance,
}: {
  overview: MonthRow[]
  totalIncomes: number
  totalExpensesYTD: number
  totalInvested: number
  finalBalance: number
}) {
  return (
    <>
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
            {overview.map((row) => (
              <tr key={row.month} className="border-b last:border-0 hover:bg-bg-muted">
                <td className="px-4 py-3 font-medium">{formatMonthAbbr(row.month)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-positive">
                  <SensitiveAmount value={row.totalIncomes} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-negative">
                  <SensitiveAmount value={row.totalExpenses} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-accent">
                  <SensitiveAmount value={row.totalInvested} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-medium tabular-nums',
                    row.balance >= 0 ? 'text-positive' : 'text-negative'
                  )}
                >
                  <SensitiveAmount value={row.balance} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-bg-muted font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-positive">
                <SensitiveAmount value={totalIncomes} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-negative">
                <SensitiveAmount value={totalExpensesYTD} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-accent">
                <SensitiveAmount value={totalInvested} />
              </td>
              <td
                className={cn(
                  'px-4 py-3 text-right tabular-nums',
                  finalBalance >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                <SensitiveAmount value={finalBalance} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="divide-y md:hidden">
        {overview.map((row) => (
          <div key={row.month} className="px-4 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-small font-semibold">{formatMonthAbbr(row.month)}</span>
              <span
                className={cn(
                  'text-small font-medium tabular-nums',
                  row.balance >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                <SensitiveAmount value={row.balance} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-caption text-text-secondary">
              <div>
                <span className="block">Entradas</span>
                <span className="font-medium tabular-nums text-positive">
                  <SensitiveAmount value={row.totalIncomes} />
                </span>
              </div>
              <div>
                <span className="block">Gastos</span>
                <span className="font-medium tabular-nums text-negative">
                  <SensitiveAmount value={row.totalExpenses} />
                </span>
              </div>
              <div>
                <span className="block">Investido</span>
                <span className="font-medium tabular-nums text-accent">
                  <SensitiveAmount value={row.totalInvested} />
                </span>
              </div>
            </div>
          </div>
        ))}
        {/* Summary row on mobile */}
        <div className="bg-bg-muted px-4 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-small font-bold">Total</span>
            <span
              className={cn(
                'text-small font-bold tabular-nums',
                finalBalance >= 0 ? 'text-positive' : 'text-negative'
              )}
            >
              <SensitiveAmount value={finalBalance} />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-caption text-text-secondary">
            <div>
              <span className="block">Entradas</span>
              <span className="font-semibold tabular-nums text-positive">
                <SensitiveAmount value={totalIncomes} />
              </span>
            </div>
            <div>
              <span className="block">Gastos</span>
              <span className="font-semibold tabular-nums text-negative">
                <SensitiveAmount value={totalExpensesYTD} />
              </span>
            </div>
            <div>
              <span className="block">Investido</span>
              <span className="font-semibold tabular-nums text-accent">
                <SensitiveAmount value={totalInvested} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
