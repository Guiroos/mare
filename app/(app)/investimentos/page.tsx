import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getInvestmentBalances,
  getInvestmentHistory,
  getInvestmentWithdrawals,
  getPatrimonyTimeline,
} from '@/lib/queries/investments'
import { deleteInvestmentType, deleteInvestment, deleteWithdrawal } from '@/lib/actions/investments'
import { formatCurrency } from '@/lib/utils/currency'
import { formatMonthName, referenceMonthToYearMonth, formatDate } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Separator } from '@/components/ui/separator'
import { InvestmentTypeDialog } from '@/components/investimentos/InvestmentTypeDialog'
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog'
import { WithdrawalDialog } from '@/components/investimentos/WithdrawalDialog'
import { WithdrawalEditButton } from '@/components/investimentos/WithdrawalEditButton'
import { DeleteButton } from '@/components/ui/delete-button'
import { PatrimonyChart } from '@/components/charts/PatrimonyChart'

export default async function InvestimentosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = (session.user as { id: string }).id

  const [balances, withdrawals, timeline] = await Promise.all([
    getInvestmentBalances(userId),
    getInvestmentWithdrawals(userId),
    getPatrimonyTimeline(userId),
  ])

  const histories = await Promise.all(balances.map((b) => getInvestmentHistory(userId, b.id)))

  const investmentTypeOptions = balances.map((b) => ({ id: b.id, name: b.name }))

  const totalPatrimony = balances.reduce((sum, b) => sum + b.currentBalance, 0)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Investimentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus aportes, rendimentos e patrimônio acumulado.
        </p>
      </div>

      {/* ─── Patrimônio total ─────────────────────────────────────────────── */}
      {balances.length > 0 && (
        <div className="rounded-xl border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Patrimônio total</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalPatrimony)}</p>
        </div>
      )}

      {/* ─── Por tipo ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Patrimônio por tipo
          </h2>
          <InvestmentTypeDialog mode="create" />
        </div>

        {balances.length === 0 ? (
          <EmptyState title="Nenhum tipo de investimento cadastrado." />
        ) : (
          <div className="space-y-3">
            {balances.map((balance, idx) => {
              const history = histories[idx]
              return (
                <div key={balance.id} className="rounded-xl border bg-card">
                  {/* Header do tipo */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{balance.name}</span>
                          {balance.pendingYield && (
                            <Badge variant="warning">Rendimento pendente</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold">
                            {formatCurrency(balance.currentBalance)}
                          </span>
                          <InvestmentTypeDialog
                            mode="edit"
                            type={{ id: balance.id, name: balance.name }}
                          />
                          <DeleteButton
                            onDelete={async () => {
                              'use server'
                              await deleteInvestmentType(balance.id)
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                        <span>Aportes: {formatCurrency(balance.totalAmount)}</span>
                        <span>Rendimentos: {formatCurrency(balance.totalYield)}</span>
                        {balance.totalWithdrawn > 0 && (
                          <span>Resgates: −{formatCurrency(balance.totalWithdrawn)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Histórico mensal */}
                  {history.length > 0 && (
                    <>
                      <Separator />
                      <div className="overflow-x-auto px-4 py-3">
                        <table className="w-full min-w-[400px] text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="pb-2 text-left font-medium">Mês</th>
                              <th className="pb-2 text-right font-medium">Aporte</th>
                              <th className="pb-2 text-right font-medium">Rendimento</th>
                              <th className="pb-2 text-right font-medium">Notas</th>
                              <th className="pb-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {history.map((entry) => (
                              <tr key={entry.id}>
                                <td className="py-1.5 pr-4 text-muted-foreground">
                                  {formatMonthName(referenceMonthToYearMonth(entry.referenceMonth))}
                                </td>
                                <td className="py-1.5 pr-4 text-right tabular-nums">
                                  {entry.amount !== null ? formatCurrency(entry.amount) : '—'}
                                </td>
                                <td className="py-1.5 pr-4 text-right tabular-nums">
                                  {entry.yieldAmount !== null ? (
                                    formatCurrency(entry.yieldAmount)
                                  ) : (
                                    <span className="text-yellow-600">pendente</span>
                                  )}
                                </td>
                                <td className="max-w-[120px] truncate py-1.5 pr-2 text-right text-xs text-muted-foreground">
                                  {entry.notes ?? ''}
                                </td>
                                <td className="py-1.5">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <InvestmentEntryDialog
                                      investmentTypeId={balance.id}
                                      existing={entry}
                                    />
                                    <DeleteButton
                                      onDelete={async () => {
                                        'use server'
                                        await deleteInvestment(entry.id)
                                      }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Adicionar novo mês */}
                  <div className="px-4 pb-3">
                    <InvestmentEntryDialog investmentTypeId={balance.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Evolução do patrimônio ───────────────────────────────────────── */}
      {timeline.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Evolução do patrimônio
          </h2>
          <div className="rounded-xl border bg-card px-4 py-4">
            <PatrimonyChart data={timeline} />
          </div>
        </div>
      )}

      {/* ─── Resgates ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resgates
          </h2>
          <WithdrawalDialog investmentTypes={investmentTypeOptions} />
        </div>

        {withdrawals.length === 0 ? (
          <EmptyState title="Nenhum resgate registrado." />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium">Destino</th>
                  <th className="px-4 py-3 text-left font-medium">Notas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2">{w.typeName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(w.date)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(w.amount)}
                    </td>
                    <td className="px-4 py-2">
                      {w.destination === 'income' ? (
                        <Badge variant="muted">Caixa</Badge>
                      ) : (
                        <Badge variant="muted">Transferência</Badge>
                      )}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-2 text-xs text-muted-foreground">
                      {w.notes ?? ''}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <WithdrawalEditButton
                          withdrawal={w}
                          investmentTypes={investmentTypeOptions}
                        />
                        <DeleteButton
                          onDelete={async () => {
                            'use server'
                            await deleteWithdrawal(w.id)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
