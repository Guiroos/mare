import { db } from '@/lib/db'
import { investmentTypes, investments, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and, sum, asc } from 'drizzle-orm'

export async function getInvestmentTypes(userId: string) {
  return db.query.investmentTypes.findMany({
    where: eq(investmentTypes.userId, userId),
    orderBy: asc(investmentTypes.name),
  })
}

export async function getInvestmentBalances(userId: string) {
  const types = await db.query.investmentTypes.findMany({
    where: eq(investmentTypes.userId, userId),
    orderBy: asc(investmentTypes.name),
  })

  return Promise.all(
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
          .select({ totalWithdrawn: sum(investmentWithdrawals.amount) })
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
      const pendingYield = allEntries.some((e) => e.amount !== null && e.yieldAmount === null)

      return {
        id: type.id,
        name: type.name,
        goalId: type.goalId,
        totalAmount,
        totalYield,
        totalWithdrawn,
        currentBalance,
        pendingYield,
      }
    })
  )
}

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
  const rows = await db.query.investmentWithdrawals.findMany({
    where: eq(investmentWithdrawals.userId, userId),
    with: { investmentType: true },
    orderBy: (iw, { desc }) => [desc(iw.date)],
  })

  return rows.map((r) => ({
    id: r.id,
    investmentTypeId: r.investmentTypeId,
    typeName: r.investmentType.name,
    amount: Number(r.amount),
    date: r.date,
    destination: r.destination,
    notes: r.notes,
  }))
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

  const monthMap = new Map<string, number>()

  for (const inv of allInvestments) {
    const month = inv.referenceMonth.slice(0, 7)
    const prev = monthMap.get(month) ?? 0
    monthMap.set(month, prev + Number(inv.amount ?? 0) + Number(inv.yieldAmount ?? 0))
  }

  for (const wd of allWithdrawals) {
    const month = wd.date.slice(0, 7)
    const prev = monthMap.get(month) ?? 0
    monthMap.set(month, prev - Number(wd.amount))
  }

  const sortedMonths = Array.from(monthMap.keys()).sort()

  let cumulative = 0
  return sortedMonths.map((month) => {
    cumulative += monthMap.get(month)!
    return { month, total: cumulative }
  })
}
