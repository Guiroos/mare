import { db } from '@/lib/db'
import { investmentTypes, investments, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and, asc, gte, count } from 'drizzle-orm'
import { currentReferenceMonth, pastNMonths, daysUntil } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

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
  const dek = await getDekForUser(userId)

  const types = await db.query.investmentTypes.findMany({
    where: and(eq(investmentTypes.userId, userId), eq(investmentTypes.archived, showArchived)),
    orderBy: asc(investmentTypes.name),
  })

  const results = await Promise.all(
    types.map(async (type) => {
      const [investmentRows, withdrawalRows] = await Promise.all([
        db.query.investments.findMany({
          where: and(eq(investments.userId, userId), eq(investments.investmentTypeId, type.id)),
        }),
        db.query.investmentWithdrawals.findMany({
          where: and(
            eq(investmentWithdrawals.userId, userId),
            eq(investmentWithdrawals.investmentTypeId, type.id)
          ),
        }),
      ])

      const totalAmount = investmentRows.reduce(
        (acc, r) => acc + toAmount(decryptOptional(r.amount, dek)),
        0
      )
      const totalYield = investmentRows.reduce(
        (acc, r) => acc + toAmount(decryptOptional(r.yieldAmount, dek)),
        0
      )
      const totalWithdrawn = withdrawalRows.reduce(
        (acc, r) =>
          acc + toAmount(decryptField(r.amount, dek)) + toAmount(decryptOptional(r.taxAmount, dek)),
        0
      )
      const currentBalance = totalAmount + totalYield - totalWithdrawn

      const pendingEntry = investmentRows.find(
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
        entries: investmentRows
          .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
          .map((e) => ({
            id: e.id,
            referenceMonth: e.referenceMonth,
            amount: e.amount !== null ? toAmount(decryptOptional(e.amount, dek)) : null,
            yieldAmount:
              e.yieldAmount !== null ? toAmount(decryptOptional(e.yieldAmount, dek)) : null,
            notes: e.notes !== null ? decryptOptional(e.notes, dek) : null,
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
  const dek = await getDekForUser(userId)
  const rows = await db.query.investments.findMany({
    where: and(eq(investments.userId, userId), eq(investments.investmentTypeId, investmentTypeId)),
    orderBy: asc(investments.referenceMonth),
  })

  return rows.map((r) => ({
    id: r.id,
    referenceMonth: r.referenceMonth,
    amount: r.amount !== null ? toAmount(decryptOptional(r.amount, dek)) : null,
    yieldAmount: r.yieldAmount !== null ? toAmount(decryptOptional(r.yieldAmount, dek)) : null,
    notes: r.notes !== null ? decryptOptional(r.notes, dek) : null,
  }))
}

export async function getInvestmentWithdrawals(userId: string) {
  const firstVisibleMonth = pastNMonths(6)[0]
  const dek = await getDekForUser(userId)
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
    amount: toAmount(decryptField(r.amount, dek)),
    taxAmount: r.taxAmount !== null ? toAmount(decryptOptional(r.taxAmount, dek)) : null,
    date: r.date,
    destination: r.destination,
    notes: r.notes !== null ? decryptOptional(r.notes, dek) : null,
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
  const dek = await getDekForUser(userId)
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

  // Decrypt before passing to buildPatrimonyTimeline
  const decryptedInvestments = allInvestments.map((inv) => ({
    referenceMonth: inv.referenceMonth,
    amount: inv.amount !== null ? decryptOptional(inv.amount, dek) : null,
    yieldAmount: inv.yieldAmount !== null ? decryptOptional(inv.yieldAmount, dek) : null,
  }))

  const decryptedWithdrawals = allWithdrawals.map((wd) => ({
    date: wd.date,
    amount: decryptField(wd.amount, dek),
    taxAmount: wd.taxAmount !== null ? decryptOptional(wd.taxAmount, dek) : null,
  }))

  return buildPatrimonyTimeline(decryptedInvestments, decryptedWithdrawals)
}
