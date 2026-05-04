import { db } from '@/lib/db'
import { transactions, fixedExpenses, incomes, investments, categoryGroups } from '@/lib/db/schema'
import { eq, and, sum, gte, lte, inArray } from 'drizzle-orm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    return `${year}-${String(month).padStart(2, '0')}-01`
  })
}

// ─── Visão geral anual ────────────────────────────────────────────────────────

export async function getAnnualOverview(userId: string, year: number) {
  const months = yearMonths(year)

  const [incomesRows, transactionsRows, fixedExpensesRows, investmentsRows] = await Promise.all([
    db
      .select({ referenceMonth: incomes.referenceMonth, total: sum(incomes.amount) })
      .from(incomes)
      .where(and(eq(incomes.userId, userId), inArray(incomes.referenceMonth, months)))
      .groupBy(incomes.referenceMonth),
    db
      .select({ referenceMonth: transactions.referenceMonth, total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.referenceMonth, months)))
      .groupBy(transactions.referenceMonth),
    db
      .select({ referenceMonth: fixedExpenses.referenceMonth, total: sum(fixedExpenses.amount) })
      .from(fixedExpenses)
      .where(and(eq(fixedExpenses.userId, userId), inArray(fixedExpenses.referenceMonth, months)))
      .groupBy(fixedExpenses.referenceMonth),
    db
      .select({ referenceMonth: investments.referenceMonth, total: sum(investments.amount) })
      .from(investments)
      .where(and(eq(investments.userId, userId), inArray(investments.referenceMonth, months)))
      .groupBy(investments.referenceMonth),
  ])

  const toMap = (rows: { referenceMonth: string; total: string | null }[]) =>
    new Map(rows.map((r) => [r.referenceMonth, Number(r.total ?? 0)]))

  const incomesMap = toMap(incomesRows)
  const transactionsMap = toMap(transactionsRows)
  const fixedExpensesMap = toMap(fixedExpensesRows)
  const investmentsMap = toMap(investmentsRows)

  return months.map((refMonth) => {
    const totalIncomes = incomesMap.get(refMonth) ?? 0
    const totalExpenses =
      (transactionsMap.get(refMonth) ?? 0) + (fixedExpensesMap.get(refMonth) ?? 0)
    const totalInvested = investmentsMap.get(refMonth) ?? 0
    const balance = totalIncomes - totalExpenses - totalInvested
    return { month: refMonth.slice(0, 7), totalIncomes, totalExpenses, totalInvested, balance }
  })
}

// ─── Gastos anuais por grupo de categoria ─────────────────────────────────────

export async function getAnnualExpensesByGroup(userId: string, year: number) {
  const firstMonth = `${year}-01-01`
  const lastMonth = `${year}-12-01`

  // Fetch all category groups with their categories in one query
  const groups = await db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: { categories: true },
  })

  // Build a map: categoryId → { groupId, groupName }
  const categoryToGroup = new Map<string, { groupId: string; groupName: string }>()
  for (const group of groups) {
    for (const cat of group.categories) {
      categoryToGroup.set(cat.id, { groupId: group.id, groupName: group.name })
    }
  }

  // Fetch all transactions and fixed expenses for the year in one query each
  const [allTransactions, allFixedExpenses] = await Promise.all([
    db
      .select({
        categoryId: transactions.categoryId,
        referenceMonth: transactions.referenceMonth,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.referenceMonth, firstMonth),
          lte(transactions.referenceMonth, lastMonth)
        )
      ),
    db
      .select({
        categoryId: fixedExpenses.categoryId,
        referenceMonth: fixedExpenses.referenceMonth,
        amount: fixedExpenses.amount,
      })
      .from(fixedExpenses)
      .where(
        and(
          eq(fixedExpenses.userId, userId),
          gte(fixedExpenses.referenceMonth, firstMonth),
          lte(fixedExpenses.referenceMonth, lastMonth)
        )
      ),
  ])

  // Aggregate in memory: month → groupId → total
  const monthGroupMap = new Map<string, Map<string, { groupName: string; total: number }>>()

  for (const t of [...allTransactions, ...allFixedExpenses]) {
    const month = t.referenceMonth.slice(0, 7) // YYYY-MM
    const groupInfo = categoryToGroup.get(t.categoryId)
    if (!groupInfo) continue

    if (!monthGroupMap.has(month)) {
      monthGroupMap.set(month, new Map())
    }
    const groupMap = monthGroupMap.get(month)!

    const existing = groupMap.get(groupInfo.groupId) ?? {
      groupName: groupInfo.groupName,
      total: 0,
    }
    existing.total += Number(t.amount)
    groupMap.set(groupInfo.groupId, existing)
  }

  // Build output for all 12 months (include months with no transactions as empty)
  const months = yearMonths(year)
  return months.map((refMonth) => {
    const month = refMonth.slice(0, 7)
    const groupMap = monthGroupMap.get(month) ?? new Map()
    const groupEntries = Array.from(groupMap.entries()).map(([groupId, data]) => ({
      groupId,
      groupName: data.groupName,
      total: data.total,
    }))
    return { month, groups: groupEntries }
  })
}
