import { db } from '@/lib/db'
import { goals, investmentTypes, investments, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and, sum, asc, inArray } from 'drizzle-orm'
import { addMonths, format } from 'date-fns'

export type GoalWithProgress = {
  id: string
  name: string
  targetAmount: number
  targetDate: string | null
  investmentTypeId: string | null
  investmentTypeName: string | null
  currentBalance: number
  progress: number
  projectedCompletionYearMonth: string | null
  contributions: Array<{
    id: string
    amount: number
    referenceMonth: string
    source: string
  }>
}

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
  })

  if (allGoals.length === 0) return []

  // Bulk-fetch investment data for all goals that reference an investmentType (3 queries total)
  const investmentTypeIds = allGoals
    .map((g) => g.investmentTypeId)
    .filter((id): id is string => id !== null)

  const [bulkSums, bulkWithdrawals, bulkRecent] =
    investmentTypeIds.length > 0
      ? await Promise.all([
          db
            .select({
              typeId: investments.investmentTypeId,
              totalAmount: sum(investments.amount),
              totalYield: sum(investments.yieldAmount),
            })
            .from(investments)
            .where(
              and(
                eq(investments.userId, userId),
                inArray(investments.investmentTypeId, investmentTypeIds)
              )
            )
            .groupBy(investments.investmentTypeId),
          db
            .select({
              typeId: investmentWithdrawals.investmentTypeId,
              totalWithdrawn: sum(investmentWithdrawals.amount),
            })
            .from(investmentWithdrawals)
            .where(
              and(
                eq(investmentWithdrawals.userId, userId),
                inArray(investmentWithdrawals.investmentTypeId, investmentTypeIds)
              )
            )
            .groupBy(investmentWithdrawals.investmentTypeId),
          db.query.investments.findMany({
            where: and(
              eq(investments.userId, userId),
              inArray(investments.investmentTypeId, investmentTypeIds)
            ),
            orderBy: (i, { desc }) => [desc(i.referenceMonth)],
          }),
        ])
      : [[], [], []]

  // Build lookup maps for O(1) access per goal
  const sumsMap = new Map(bulkSums.map((r) => [r.typeId, r]))
  const withdrawalsMap = new Map(bulkWithdrawals.map((r) => [r.typeId, r]))
  const recentByType = new Map<string, typeof bulkRecent>()
  for (const entry of bulkRecent) {
    const list = recentByType.get(entry.investmentTypeId) ?? []
    if (list.length < 3) list.push(entry)
    recentByType.set(entry.investmentTypeId, list)
  }

  return allGoals.map((goal) => {
    const targetAmount = Number(goal.targetAmount)
    let currentBalance = 0
    let recentMonthlyAmounts: number[] = []

    if (goal.investmentTypeId) {
      const s = sumsMap.get(goal.investmentTypeId)
      const w = withdrawalsMap.get(goal.investmentTypeId)
      const last3 = recentByType.get(goal.investmentTypeId) ?? []
      const totalAmount = Number(s?.totalAmount ?? 0)
      const totalYield = Number(s?.totalYield ?? 0)
      const totalWithdrawn = Number(w?.totalWithdrawn ?? 0)
      currentBalance = totalAmount + totalYield - totalWithdrawn
      recentMonthlyAmounts = last3.map((i) => Number(i.amount ?? 0) + Number(i.yieldAmount ?? 0))
    } else {
      // contributions are already fetched — compute in JS, no extra queries
      currentBalance = goal.contributions.reduce((sum, c) => sum + Number(c.amount), 0)
      recentMonthlyAmounts = goal.contributions.slice(0, 3).map((c) => Number(c.amount))
    }

    const progress = targetAmount > 0 ? Math.min(100, (currentBalance / targetAmount) * 100) : 0

    let projectedCompletionYearMonth: string | null = null
    const remaining = targetAmount - currentBalance
    if (remaining > 0 && recentMonthlyAmounts.length > 0) {
      const avgMonthly =
        recentMonthlyAmounts.reduce((a, b) => a + b, 0) / recentMonthlyAmounts.length
      if (avgMonthly > 0) {
        const monthsNeeded = Math.ceil(remaining / avgMonthly)
        projectedCompletionYearMonth = format(addMonths(new Date(), monthsNeeded), 'yyyy-MM')
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
    }
  })
}

export async function getInvestmentTypesForGoals(userId: string) {
  return db.query.investmentTypes.findMany({
    where: eq(investmentTypes.userId, userId),
    orderBy: asc(investmentTypes.name),
  })
}
