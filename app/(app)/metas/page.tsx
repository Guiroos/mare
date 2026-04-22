import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getGoalsWithProgress, getInvestmentTypesForGoals } from '@/lib/queries/goals';
import { deleteGoal, deleteGoalContribution } from '@/lib/actions/goals';
import { formatCurrency, formatMonth, referenceMonthToYearMonth } from '@/lib/format';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GoalDialog } from '@/components/metas/GoalDialog';
import { ContributionDialog } from '@/components/metas/ContributionDialog';
import { ContributionEditButton } from '@/components/metas/ContributionEditButton';
import { DeleteButton } from '@/components/ui/delete-button';

export default async function MetasPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = (session.user as any).id as string;

  const [goalsData, investmentTypes] = await Promise.all([
    getGoalsWithProgress(userId),
    getInvestmentTypesForGoals(userId),
  ]);

  const investmentTypeOptions = investmentTypes.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">Metas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe o progresso das suas metas financeiras.
        </p>
      </div>

      {/* ─── Lista de metas ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Suas metas
          </h2>
          <GoalDialog mode="create" investmentTypes={investmentTypeOptions} />
        </div>

        {goalsData.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma meta cadastrada. Crie sua primeira meta para começar.
          </div>
        ) : (
          <div className="space-y-3">
            {goalsData.map((goal) => {
              const isComplete = goal.progress >= 100;
              return (
                <div key={goal.id} className="rounded-xl border bg-card">
                  {/* Header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{goal.name}</span>
                        {isComplete && (
                          <Badge className="bg-green-600 text-white text-xs">
                            Meta atingida!
                          </Badge>
                        )}
                        {goal.investmentTypeName && (
                          <Badge variant="outline" className="text-xs">
                            {goal.investmentTypeName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <GoalDialog
                          mode="edit"
                          investmentTypes={investmentTypeOptions}
                          goal={{
                            id: goal.id,
                            name: goal.name,
                            targetAmount: goal.targetAmount,
                            targetDate: goal.targetDate,
                            investmentTypeId: goal.investmentTypeId,
                          }}
                        />
                        <DeleteButton
                          onDelete={async () => {
                            'use server';
                            await deleteGoal(goal.id);
                          }}
                        />
                      </div>
                    </div>

                    {/* Progresso */}
                    <div className="mt-3 space-y-1.5">
                      <Progress
                        value={goal.currentBalance}
                        max={goal.targetAmount}
                        indicatorClassName={isComplete ? 'bg-green-600' : undefined}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {formatCurrency(goal.currentBalance)} de{' '}
                          {formatCurrency(goal.targetAmount)}
                        </span>
                        <span className="font-medium">
                          {goal.progress.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Datas */}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {goal.targetDate && (
                        <span>
                          Prazo:{' '}
                          {new Date(goal.targetDate + 'T12:00:00').toLocaleDateString(
                            'pt-BR',
                            { month: 'long', year: 'numeric' }
                          )}
                        </span>
                      )}
                      {!isComplete && goal.projectedCompletionYearMonth && (
                        <span>
                          Projeção: {formatMonth(goal.projectedCompletionYearMonth)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aportes manuais (apenas para metas sem vínculo) */}
                  {!goal.investmentTypeId && (
                    <>
                      <Separator />
                      <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Aportes
                          </span>
                          <ContributionDialog goalId={goal.id} />
                        </div>

                        {goal.contributions.length > 0 && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground">
                                <th className="text-left font-medium pb-1.5">Mês</th>
                                <th className="text-right font-medium pb-1.5">Valor</th>
                                <th className="pb-1.5" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {goal.contributions.map((c) => (
                                <tr key={c.id}>
                                  <td className="py-1.5 text-muted-foreground">
                                    {formatMonth(
                                      referenceMonthToYearMonth(c.referenceMonth)
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {formatCurrency(c.amount)}
                                  </td>
                                  <td className="py-1.5 pl-2">
                                    <div className="flex items-center gap-1">
                                      <ContributionEditButton contribution={c} />
                                      <DeleteButton
                                        onDelete={async () => {
                                          'use server';
                                          await deleteGoalContribution(c.id);
                                        }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
