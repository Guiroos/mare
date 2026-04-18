import { db } from '@/lib/db';
import {
  goals,
  goalContributions,
  investmentTypes,
  investments,
  investmentWithdrawals,
} from '@/lib/db/schema';
import { eq, and, sum, asc } from 'drizzle-orm';

export type GoalWithProgress = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  investmentTypeId: string | null;
  investmentTypeName: string | null;
  currentBalance: number;
  progress: number;
  projectedCompletionYearMonth: string | null;
  contributions: Array<{
    id: string;
    amount: number;
    referenceMonth: string;
    source: string;
  }>;
};

export async function getGoalsWithProgress(userId: string): Promise<GoalWithProgress[]> {
  const allGoals = await db.query.goals.findMany({
    where: eq(goals.userId, userId),
    with: {
      investmentType: true,
      contributions: {
        orderBy: (c, { desc }) => [desc(c.referenceMonth)],
      },
    },
    orderBy: asc(goals.name),
  });

  return Promise.all(
    allGoals.map(async (goal) => {
      const targetAmount = Number(goal.targetAmount);
      let currentBalance = 0;
      let recentMonthlyAmounts: number[] = [];

      if (goal.investmentTypeId) {
        const [amountResult, withdrawalResult, last3] = await Promise.all([
          db
            .select({
              totalAmount: sum(investments.amount),
              totalYield: sum(investments.yieldAmount),
            })
            .from(investments)
            .where(
              and(
                eq(investments.userId, userId),
                eq(investments.investmentTypeId, goal.investmentTypeId)
              )
            ),
          db
            .select({ totalWithdrawn: sum(investmentWithdrawals.amount) })
            .from(investmentWithdrawals)
            .where(
              and(
                eq(investmentWithdrawals.userId, userId),
                eq(investmentWithdrawals.investmentTypeId, goal.investmentTypeId)
              )
            ),
          db.query.investments.findMany({
            where: and(
              eq(investments.userId, userId),
              eq(investments.investmentTypeId, goal.investmentTypeId)
            ),
            orderBy: (i, { desc }) => [desc(i.referenceMonth)],
            limit: 3,
          }),
        ]);

        const totalAmount = Number(amountResult[0]?.totalAmount ?? 0);
        const totalYield = Number(amountResult[0]?.totalYield ?? 0);
        const totalWithdrawn = Number(withdrawalResult[0]?.totalWithdrawn ?? 0);
        currentBalance = totalAmount + totalYield - totalWithdrawn;
        recentMonthlyAmounts = last3.map(
          (i) => Number(i.amount ?? 0) + Number(i.yieldAmount ?? 0)
        );
      } else {
        const [result, last3] = await Promise.all([
          db
            .select({ total: sum(goalContributions.amount) })
            .from(goalContributions)
            .where(
              and(
                eq(goalContributions.userId, userId),
                eq(goalContributions.goalId, goal.id)
              )
            ),
          db.query.goalContributions.findMany({
            where: and(
              eq(goalContributions.userId, userId),
              eq(goalContributions.goalId, goal.id)
            ),
            orderBy: (c, { desc }) => [desc(c.referenceMonth)],
            limit: 3,
          }),
        ]);
        currentBalance = Number(result[0]?.total ?? 0);
        recentMonthlyAmounts = last3.map((c) => Number(c.amount));
      }

      const progress =
        targetAmount > 0 ? Math.min(100, (currentBalance / targetAmount) * 100) : 0;

      let projectedCompletionYearMonth: string | null = null;
      const remaining = targetAmount - currentBalance;
      if (remaining > 0 && recentMonthlyAmounts.length > 0) {
        const avgMonthly =
          recentMonthlyAmounts.reduce((a, b) => a + b, 0) / recentMonthlyAmounts.length;
        if (avgMonthly > 0) {
          const monthsNeeded = Math.ceil(remaining / avgMonthly);
          const projDate = new Date();
          projDate.setMonth(projDate.getMonth() + monthsNeeded);
          projectedCompletionYearMonth = `${projDate.getFullYear()}-${String(
            projDate.getMonth() + 1
          ).padStart(2, '0')}`;
        }
      }

      return {
        id: goal.id,
        name: goal.name,
        targetAmount,
        targetDate: goal.targetDate,
        investmentTypeId: goal.investmentTypeId,
        investmentTypeName: goal.investmentType?.name ?? null,
        currentBalance,
        progress,
        projectedCompletionYearMonth,
        contributions: goal.contributions.map((c) => ({
          id: c.id,
          amount: Number(c.amount),
          referenceMonth: c.referenceMonth,
          source: c.source,
        })),
      };
    })
  );
}

export async function getInvestmentTypesForGoals(userId: string) {
  return db.query.investmentTypes.findMany({
    where: eq(investmentTypes.userId, userId),
    orderBy: asc(investmentTypes.name),
  });
}
