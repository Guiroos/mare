import { db } from '@/lib/db'
import { goals, investmentTypes, investments, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { addMonths, format } from 'date-fns'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

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
  const dek = await getDekForUser(userId)

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

  // Bulk-fetch investment data for all goals that reference an investmentType
  const investmentTypeIds = allGoals
    .map((g) => g.investmentTypeId)
    .filter((id): id is string => id !== null)

  const [bulkInvestments, bulkWithdrawals, bulkRecent] =
    investmentTypeIds.length > 0
      ? await Promise.all([
          db.query.investments.findMany({
            where: and(
              eq(investments.userId, userId),
              inArray(investments.investmentTypeId, investmentTypeIds)
            ),
          }),
          db.query.investmentWithdrawals.findMany({
            where: and(
              eq(investmentWithdrawals.userId, userId),
              inArray(investmentWithdrawals.investmentTypeId, investmentTypeIds)
            ),
          }),
          db.query.investments.findMany({
            where: and(
              eq(investments.userId, userId),
              inArray(investments.investmentTypeId, investmentTypeIds)
            ),
            orderBy: (i, { desc }) => [desc(i.referenceMonth)],
          }),
        ])
      : [[], [], []]

  // Build per-type totals in JS after decryption
  const amountsByType = new Map<string, { totalAmount: number; totalYield: number }>()
  for (const inv of bulkInvestments) {
    const prev = amountsByType.get(inv.investmentTypeId) ?? { totalAmount: 0, totalYield: 0 }
    amountsByType.set(inv.investmentTypeId, {
      totalAmount: prev.totalAmount + toAmount(decryptOptional(inv.amount, dek)),
      totalYield: prev.totalYield + toAmount(decryptOptional(inv.yieldAmount, dek)),
    })
  }

  const withdrawnByType = new Map<string, number>()
  for (const wd of bulkWithdrawals) {
    const prev = withdrawnByType.get(wd.investmentTypeId) ?? 0
    withdrawnByType.set(
      wd.investmentTypeId,
      prev + toAmount(decryptField(wd.amount, dek)) + toAmount(decryptOptional(wd.taxAmount, dek))
    )
  }

  const recentByType = new Map<string, typeof bulkRecent>()
  for (const entry of bulkRecent) {
    const list = recentByType.get(entry.investmentTypeId) ?? []
    if (list.length < 3) list.push(entry)
    recentByType.set(entry.investmentTypeId, list)
  }

  return allGoals.map((goal) => {
    const targetAmount = toAmount(goal.targetAmount)
    let currentBalance = 0
    let recentMonthlyAmounts: number[] = []

    if (goal.investmentTypeId) {
      const s = amountsByType.get(goal.investmentTypeId) ?? { totalAmount: 0, totalYield: 0 }
      const totalWithdrawn = withdrawnByType.get(goal.investmentTypeId) ?? 0
      const last3 = recentByType.get(goal.investmentTypeId) ?? []
      currentBalance = s.totalAmount + s.totalYield - totalWithdrawn
      recentMonthlyAmounts = last3.map(
        (i) =>
          toAmount(decryptOptional(i.amount, dek)) + toAmount(decryptOptional(i.yieldAmount, dek))
      )
    } else {
      // contributions are already fetched — compute in JS, no extra queries
      currentBalance = goal.contributions.reduce(
        (sum, c) => sum + toAmount(decryptField(c.amount, dek)),
        0
      )
      recentMonthlyAmounts = goal.contributions
        .slice(0, 3)
        .map((c) => toAmount(decryptField(c.amount, dek)))
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
        amount: toAmount(decryptField(c.amount, dek)),
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
