import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  categoryGroups,
  paymentAccounts,
} from '@/lib/db/schema'
import { eq, and, sum, gte, lte, inArray, sql, ne, lt, or } from 'drizzle-orm'
import { currentYear } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { FaturaContext } from '@/lib/queries/fatura'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    return `${year}-${String(month).padStart(2, '0')}-01`
  })
}

// ─── Anos disponíveis ─────────────────────────────────────────────────────────

export async function getAvailableYears(userId: string): Promise<number[]> {
  const [incomesYears, txYears, fixedYears] = await Promise.all([
    db
      .selectDistinct({ year: sql<number>`EXTRACT(YEAR FROM ${incomes.referenceMonth})::int` })
      .from(incomes)
      .where(eq(incomes.userId, userId)),
    db
      .selectDistinct({
        year: sql<number>`EXTRACT(YEAR FROM ${transactions.referenceMonth})::int`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    db
      .selectDistinct({
        year: sql<number>`EXTRACT(YEAR FROM ${fixedExpenses.referenceMonth})::int`,
      })
      .from(fixedExpenses)
      .where(eq(fixedExpenses.userId, userId)),
  ])

  const all = [...incomesYears, ...txYears, ...fixedYears].map((r) => r.year)
  const unique = Array.from(new Set(all)).sort((a, b) => a - b)
  return unique.length > 0 ? unique : [currentYear()]
}

// ─── Visão geral anual ────────────────────────────────────────────────────────
// Em regime de fatura, usa JOIN com paymentAccounts para excluir contas de crédito
// nos meses com regime ativo — sem query extra de soma.

export async function getAnnualOverview(userId: string, year: number, faturaCtx?: FaturaContext) {
  const months = yearMonths(year)

  const isFaturaMode =
    faturaCtx !== undefined &&
    faturaCtx.creditMode === 'fatura' &&
    faturaCtx.faturaActiveFrom !== null

  const [incomesRows, transactionsRows, fixedExpensesRows, investmentsRows] = await Promise.all([
    db
      .select({
        referenceMonth: incomes.referenceMonth,
        total: sql<string>`SUM(
          CASE
            WHEN ${incomes.investmentReturnCapital} IS NOT NULL
            THEN ${incomes.amount} - ${incomes.investmentReturnCapital}
            ELSE ${incomes.amount}
          END
        )`,
      })
      .from(incomes)
      .where(and(eq(incomes.userId, userId), inArray(incomes.referenceMonth, months)))
      .groupBy(incomes.referenceMonth),

    isFaturaMode
      ? db
          .select({ referenceMonth: transactions.referenceMonth, total: sum(transactions.amount) })
          .from(transactions)
          .innerJoin(paymentAccounts, eq(transactions.accountId, paymentAccounts.id))
          .where(
            and(
              eq(transactions.userId, userId),
              inArray(transactions.referenceMonth, months),
              or(
                lt(transactions.referenceMonth, faturaCtx.faturaActiveFrom!),
                ne(paymentAccounts.type, 'credit')
              )
            )
          )
          .groupBy(transactions.referenceMonth)
      : db
          .select({ referenceMonth: transactions.referenceMonth, total: sum(transactions.amount) })
          .from(transactions)
          .where(and(eq(transactions.userId, userId), inArray(transactions.referenceMonth, months)))
          .groupBy(transactions.referenceMonth),

    isFaturaMode
      ? db
          .select({
            referenceMonth: fixedExpenses.referenceMonth,
            total: sum(fixedExpenses.amount),
          })
          .from(fixedExpenses)
          .innerJoin(paymentAccounts, eq(fixedExpenses.accountId, paymentAccounts.id))
          .where(
            and(
              eq(fixedExpenses.userId, userId),
              inArray(fixedExpenses.referenceMonth, months),
              or(
                lt(fixedExpenses.referenceMonth, faturaCtx.faturaActiveFrom!),
                ne(paymentAccounts.type, 'credit')
              )
            )
          )
          .groupBy(fixedExpenses.referenceMonth)
      : db
          .select({
            referenceMonth: fixedExpenses.referenceMonth,
            total: sum(fixedExpenses.amount),
          })
          .from(fixedExpenses)
          .where(
            and(eq(fixedExpenses.userId, userId), inArray(fixedExpenses.referenceMonth, months))
          )
          .groupBy(fixedExpenses.referenceMonth),

    db
      .select({ referenceMonth: investments.referenceMonth, total: sum(investments.amount) })
      .from(investments)
      .where(
        and(
          eq(investments.userId, userId),
          inArray(investments.referenceMonth, months),
          eq(investments.excludeFromCashFlow, false)
        )
      )
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

export type OverviewMonth = Awaited<ReturnType<typeof getAnnualOverview>>[number]

// ─── Gastos anuais por grupo de categoria ─────────────────────────────────────

export async function getAnnualExpensesByGroup(
  userId: string,
  year: number,
  faturaCtx?: FaturaContext
) {
  const firstMonth = `${year}-01-01`
  const lastMonth = `${year}-12-01`

  const isFaturaMode =
    faturaCtx !== undefined &&
    faturaCtx.creditMode === 'fatura' &&
    faturaCtx.faturaActiveFrom !== null

  const creditIdSet = new Set(faturaCtx?.creditAccountIds ?? [])

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
        accountId: transactions.accountId,
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
        accountId: fixedExpenses.accountId,
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
    if (!t.categoryId) continue

    // Skip credit account expenses in fatura months
    if (
      isFaturaMode &&
      faturaCtx!.faturaActiveFrom !== null &&
      t.referenceMonth >= faturaCtx!.faturaActiveFrom &&
      creditIdSet.has(t.accountId)
    ) {
      continue
    }

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
    existing.total += toAmount(t.amount)
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
