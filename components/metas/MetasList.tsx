'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Separator } from '@/components/ui/separator'
import { GoalDialog } from '@/components/metas/GoalDialog'
import { ContributionDialog } from '@/components/metas/ContributionDialog'
import { ContributionEditButton } from '@/components/metas/ContributionEditButton'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteGoal, deleteGoalContribution } from '@/lib/actions/goals'
import { formatMonthName, referenceMonthToYearMonth } from '@/lib/utils/date'

type Contribution = {
  id: string
  referenceMonth: string
  amount: number
}

type Goal = {
  id: string
  name: string
  progress: number
  currentBalance: number
  targetAmount: number
  targetDate: string | null
  investmentTypeName: string | null
  investmentTypeId: string | null
  projectedCompletionYearMonth: string | null
  contributions: Contribution[]
}

type InvestmentTypeOption = { id: string; name: string }

export function MetasList({
  goals,
  investmentTypeOptions,
}: {
  goals: Goal[]
  investmentTypeOptions: InvestmentTypeOption[]
}) {
  if (goals.length === 0) {
    return <EmptyState title="Nenhuma meta cadastrada. Crie sua primeira meta para começar." />
  }

  return (
    <div className="space-y-3">
      {goals.map((goal) => {
        const isComplete = goal.progress >= 100
        return (
          <div key={goal.id} className="rounded-xl border bg-bg-surface">
            {/* Header */}
            <div className="px-4 pb-3 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{goal.name}</span>
                  {isComplete && <Badge variant="positive">Meta atingida!</Badge>}
                  {goal.investmentTypeName && (
                    <Badge variant="muted">{goal.investmentTypeName}</Badge>
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
                      'use server'
                      await deleteGoal(goal.id)
                    }}
                  />
                </div>
              </div>

              {/* Progresso */}
              <div className="mt-3 space-y-1.5">
                <Progress
                  value={goal.currentBalance}
                  max={goal.targetAmount}
                  indicatorClassName={isComplete ? 'bg-positive' : undefined}
                />
                <div className="flex items-center justify-between text-caption text-text-secondary">
                  <span className="tabular-nums">
                    <SensitiveAmount value={goal.currentBalance} /> de{' '}
                    <SensitiveAmount value={goal.targetAmount} />
                  </span>
                  <span className="font-medium tabular-nums">{goal.progress.toFixed(1)}%</span>
                </div>
              </div>

              {/* Datas */}
              <div className="mt-2 flex flex-wrap gap-4 text-caption text-text-secondary">
                {goal.targetDate && (
                  <span>Prazo: {formatMonthName(goal.targetDate.slice(0, 7))}</span>
                )}
                {!isComplete && goal.projectedCompletionYearMonth && (
                  <span>Projeção: {formatMonthName(goal.projectedCompletionYearMonth)}</span>
                )}
              </div>
            </div>

            {/* Aportes manuais */}
            {!goal.investmentTypeId && (
              <>
                <Separator />
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium text-text-secondary">Aportes</span>
                    <ContributionDialog goalId={goal.id} />
                  </div>

                  {goal.contributions.length > 0 && (
                    <table className="w-full text-small">
                      <thead>
                        <tr className="text-caption text-text-secondary">
                          <th className="pb-1.5 text-left font-medium">Mês</th>
                          <th className="pb-1.5 text-right font-medium">Valor</th>
                          <th className="pb-1.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {goal.contributions.map((c) => (
                          <tr key={c.id}>
                            <td className="py-1.5 text-text-secondary">
                              {formatMonthName(referenceMonthToYearMonth(c.referenceMonth))}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">
                              <SensitiveAmount value={c.amount} />
                            </td>
                            <td className="py-1.5 pl-2">
                              <div className="flex items-center gap-1">
                                <ContributionEditButton contribution={c} />
                                <DeleteButton
                                  onDelete={async () => {
                                    'use server'
                                    await deleteGoalContribution(c.id)
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
        )
      })}
    </div>
  )
}
