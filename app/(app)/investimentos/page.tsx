import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getInvestmentBalances,
  getInvestmentHistory,
  getInvestmentWithdrawals,
  getPatrimonyTimeline,
} from '@/lib/queries/investments';
import {
  deleteInvestmentType,
  deleteInvestment,
  deleteWithdrawal,
} from '@/lib/actions/investments';
import { formatCurrency, referenceMonthToYearMonth, formatMonth } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import { InvestmentTypeDialog } from '@/components/investimentos/InvestmentTypeDialog';
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog';
import { WithdrawalDialog } from '@/components/investimentos/WithdrawalDialog';
import { WithdrawalEditButton } from '@/components/investimentos/WithdrawalEditButton';
import { DeleteButton } from '@/components/ui/delete-button';
import { PatrimonyChart } from '@/components/charts/PatrimonyChart';

export default async function InvestimentosPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = (session.user as any).id as string;

  const [balances, withdrawals, timeline] = await Promise.all([
    getInvestmentBalances(userId),
    getInvestmentWithdrawals(userId),
    getPatrimonyTimeline(userId),
  ]);

  const histories = await Promise.all(
    balances.map((b) => getInvestmentHistory(userId, b.id))
  );

  const investmentTypeOptions = balances.map((b) => ({ id: b.id, name: b.name }));

  const totalPatrimony = balances.reduce((sum, b) => sum + b.currentBalance, 0);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">Investimentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe seus aportes, rendimentos e patrimônio acumulado.
        </p>
      </div>

      {/* ─── Patrimônio total ─────────────────────────────────────────────── */}
      {balances.length > 0 && (
        <div className="rounded-xl border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Patrimônio total</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalPatrimony)}</p>
        </div>
      )}

      {/* ─── Por tipo ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Patrimônio por tipo
          </h2>
          <InvestmentTypeDialog mode="create" />
        </div>

        {balances.length === 0 ? (
          <EmptyState title="Nenhum tipo de investimento cadastrado." />
        ) : (
          <div className="space-y-3">
            {balances.map((balance, idx) => {
              const history = histories[idx];
              return (
                <div key={balance.id} className="rounded-xl border bg-card">
                  {/* Header do tipo */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{balance.name}</span>
                          {balance.pendingYield && (
                            <Badge variant="warning">
                              Rendimento pendente
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold">
                            {formatCurrency(balance.currentBalance)}
                          </span>
                          <InvestmentTypeDialog mode="edit" type={{ id: balance.id, name: balance.name }} />
                          <DeleteButton
                            onDelete={async () => {
                              'use server';
                              await deleteInvestmentType(balance.id);
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
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
                      <div className="px-4 py-3 overflow-x-auto">
                        <table className="w-full text-sm min-w-[400px]">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left font-medium pb-2">Mês</th>
                              <th className="text-right font-medium pb-2">Aporte</th>
                              <th className="text-right font-medium pb-2">Rendimento</th>
                              <th className="text-right font-medium pb-2">Notas</th>
                              <th className="pb-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {history.map((entry) => (
                              <tr key={entry.id}>
                                <td className="py-1.5 pr-4 text-muted-foreground">
                                  {formatMonth(referenceMonthToYearMonth(entry.referenceMonth))}
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
                                <td className="py-1.5 pr-2 text-right text-muted-foreground text-xs max-w-[120px] truncate">
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
                                        'use server';
                                        await deleteInvestment(entry.id);
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
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Evolução do patrimônio ───────────────────────────────────────── */}
      {timeline.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resgates
          </h2>
          <WithdrawalDialog investmentTypes={investmentTypeOptions} />
        </div>

        {withdrawals.length === 0 ? (
          <EmptyState title="Nenhum resgate registrado." />
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left font-medium px-4 py-3">Tipo</th>
                  <th className="text-left font-medium px-4 py-3">Data</th>
                  <th className="text-right font-medium px-4 py-3">Valor</th>
                  <th className="text-left font-medium px-4 py-3">Destino</th>
                  <th className="text-left font-medium px-4 py-3">Notas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2">{w.typeName}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(w.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
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
                    <td className="px-4 py-2 text-muted-foreground text-xs max-w-[120px] truncate">
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
                            'use server';
                            await deleteWithdrawal(w.id);
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
  );
}
