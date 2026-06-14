import { db } from '@/lib/db'
import { investmentTypes, investments, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and, sum, asc, gte, count, sql } from 'drizzle-orm'
import { currentReferenceMonth, pastNMonths, daysUntil } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'

export async function getInvestmentTypes(userId: string) {
  return db.query.investmentTypes.findMany({
    where: eq(investmentTypes.userId, userId),
    orderBy: asc(investmentTypes.name),
  })
}

export async function getInvestmentBalances(
  userId: string,
  { showArchived = false }: { showArchived?: boolean } = {}
) {
  const currentRefMonth = currentReferenceMonth()
  const types = await db.query.investmentTypes.findMany({
    where: and(eq(investmentTypes.userId, userId), eq(investmentTypes.archived, showArchived)),
    orderBy: asc(investmentTypes.name),
  })

  const results = await Promise.all(
    types.map(async (type) => {
      const [amountResult, withdrawalResult, allEntries] = await Promise.all([
        db
          .select({
            totalAmount: sum(investments.amount),
            totalYield: sum(investments.yieldAmount),
          })
          .from(investments)
          .where(and(eq(investments.userId, userId), eq(investments.investmentTypeId, type.id))),
        db
          .select({
            totalWithdrawn: sql<string>`coalesce(sum(${investmentWithdrawals.amount} + coalesce(${investmentWithdrawals.taxAmount}, 0)), 0)`,
          })
          .from(investmentWithdrawals)
          .where(
            and(
              eq(investmentWithdrawals.userId, userId),
              eq(investmentWithdrawals.investmentTypeId, type.id)
            )
          ),
        db.query.investments.findMany({
          where: and(eq(investments.userId, userId), eq(investments.investmentTypeId, type.id)),
        }),
      ])

      const totalAmount = Number(amountResult[0]?.totalAmount ?? 0)
      const totalYield = Number(amountResult[0]?.totalYield ?? 0)
      const totalWithdrawn = Number(withdrawalResult[0]?.totalWithdrawn ?? 0)
      const currentBalance = totalAmount + totalYield - totalWithdrawn
      const pendingEntry = allEntries.find(
        (entry) =>
          entry.referenceMonth === currentRefMonth &&
          entry.amount !== null &&
          entry.yieldAmount === null
      )
      const pendingYield = pendingEntry !== undefined

      return {
        id: type.id,
        name: type.name,
        color: type.color,
        bgColor: type.bgColor,
        goalId: type.goalId,
        maturityDate: type.maturityDate,
        archived: type.archived,
        totalAmount,
        totalYield,
        totalWithdrawn,
        currentBalance,
        pendingYield,
        pendingReferenceMonth: pendingEntry?.referenceMonth ?? null,
        entries: allEntries
          .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
          .map((e) => ({
            id: e.id,
            referenceMonth: e.referenceMonth,
            amount: e.amount !== null ? Number(e.amount) : null,
            yieldAmount: e.yieldAmount !== null ? Number(e.yieldAmount) : null,
            notes: e.notes,
            excludeFromCashFlow: e.excludeFromCashFlow,
          })),
      }
    })
  )
  return results.sort((a, b) => b.currentBalance - a.currentBalance)
}

export type InvestmentBalance = Awaited<ReturnType<typeof getInvestmentBalances>>[number]

export async function getArchivedCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(investmentTypes)
    .where(and(eq(investmentTypes.userId, userId), eq(investmentTypes.archived, true)))
  return result[0]?.count ?? 0
}

export async function getMaturityAlerts(userId: string) {
  const balances = await getInvestmentBalances(userId, { showArchived: false })
  return balances
    .filter((b) => b.maturityDate !== null && b.currentBalance > 0)
    .map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      bgColor: b.bgColor,
      maturityDate: b.maturityDate!,
      currentBalance: b.currentBalance,
      daysUntil: daysUntil(b.maturityDate!),
    }))
    .filter((b) => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

export type MaturityAlert = Awaited<ReturnType<typeof getMaturityAlerts>>[number]

export async function getInvestmentHistory(userId: string, investmentTypeId: string) {
  const rows = await db.query.investments.findMany({
    where: and(eq(investments.userId, userId), eq(investments.investmentTypeId, investmentTypeId)),
    orderBy: asc(investments.referenceMonth),
  })

  return rows.map((r) => ({
    id: r.id,
    referenceMonth: r.referenceMonth,
    amount: r.amount !== null ? Number(r.amount) : null,
    yieldAmount: r.yieldAmount !== null ? Number(r.yieldAmount) : null,
    notes: r.notes,
  }))
}

export async function getInvestmentWithdrawals(userId: string) {
  const firstVisibleMonth = pastNMonths(6)[0]
  const rows = await db.query.investmentWithdrawals.findMany({
    where: and(
      eq(investmentWithdrawals.userId, userId),
      gte(investmentWithdrawals.date, firstVisibleMonth)
    ),
    with: { investmentType: true },
    orderBy: (iw, { desc }) => [desc(iw.date)],
  })

  return rows.map((r) => ({
    id: r.id,
    investmentTypeId: r.investmentTypeId,
    typeName: r.investmentType.name,
    amount: toAmount(r.amount),
    taxAmount: r.taxAmount !== null ? Number(r.taxAmount) : null,
    date: r.date,
    destination: r.destination,
    notes: r.notes,
  }))
}

type InvestmentRow = { referenceMonth: string; amount: string | null; yieldAmount: string | null }
type WithdrawalRow = { date: string; amount: string; taxAmount: string | null }

export function buildPatrimonyTimeline(
  allInvestments: InvestmentRow[],
  allWithdrawals: WithdrawalRow[]
): Array<{ month: string; total: number; aporte: number }> {
  const monthMap = new Map<string, number>()
  const aporteMonthMap = new Map<string, number>()

  for (const inv of allInvestments) {
    const month = inv.referenceMonth.slice(0, 7)
    monthMap.set(
      month,
      (monthMap.get(month) ?? 0) + toAmount(inv.amount) + toAmount(inv.yieldAmount)
    )
    aporteMonthMap.set(month, (aporteMonthMap.get(month) ?? 0) + toAmount(inv.amount))
  }

  for (const wd of allWithdrawals) {
    const month = wd.date.slice(0, 7)
    const gross = toAmount(wd.amount) + toAmount(wd.taxAmount)
    monthMap.set(month, (monthMap.get(month) ?? 0) - gross)
    aporteMonthMap.set(month, (aporteMonthMap.get(month) ?? 0) - gross)
  }

  const sortedMonths = Array.from(monthMap.keys()).sort()

  let cumulative = 0
  let cumulativeAporte = 0
  return sortedMonths.map((month) => {
    cumulative += monthMap.get(month)!
    cumulativeAporte += aporteMonthMap.get(month) ?? 0
    return { month, total: cumulative, aporte: cumulativeAporte }
  })
}

export async function getPatrimonyTimeline(userId: string) {
  const [allInvestments, allWithdrawals] = await Promise.all([
    db.query.investments.findMany({
      where: eq(investments.userId, userId),
      orderBy: asc(investments.referenceMonth),
    }),
    db.query.investmentWithdrawals.findMany({
      where: eq(investmentWithdrawals.userId, userId),
      orderBy: asc(investmentWithdrawals.date),
    }),
  ])
  return buildPatrimonyTimeline(allInvestments, allWithdrawals)
}
