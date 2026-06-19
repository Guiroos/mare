import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  categoryGroups,
  paymentAccounts,
} from '@/lib/db/schema'
import { eq, and, gte, lte, inArray, sql, ne, lt, or } from 'drizzle-orm'
import { currentYear } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { FaturaContext } from '@/lib/queries/fatura'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

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
// Rows individuais buscados por IN — aggregação em JS após decrypt.
// Em regime de fatura, WHERE exclui contas de crédito nos meses ativos.

export async function getAnnualOverview(userId: string, year: number, faturaCtx?: FaturaContext) {
  const months = yearMonths(year)

  const isFaturaMode =
    faturaCtx !== undefined &&
    faturaCtx.creditMode === 'fatura' &&
    faturaCtx.faturaActiveFrom !== null

  const [incomesRows, transactionsRows, fixedExpensesRows, investmentsRows, dek] =
    await Promise.all([
      db
        .select({
          referenceMonth: incomes.referenceMonth,
          amount: incomes.amount,
          investmentReturnCapital: incomes.investmentReturnCapital,
        })
        .from(incomes)
        .where(and(eq(incomes.userId, userId), inArray(incomes.referenceMonth, months))),

      isFaturaMode
        ? db
            .select({ referenceMonth: transactions.referenceMonth, amount: transactions.amount })
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
        : db
            .select({ referenceMonth: transactions.referenceMonth, amount: transactions.amount })
            .from(transactions)
            .where(
              and(eq(transactions.userId, userId), inArray(transactions.referenceMonth, months))
            ),

      isFaturaMode
        ? db
            .select({
              referenceMonth: fixedExpenses.referenceMonth,
              amount: fixedExpenses.amount,
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
        : db
            .select({
              referenceMonth: fixedExpenses.referenceMonth,
              amount: fixedExpenses.amount,
            })
            .from(fixedExpenses)
            .where(
              and(eq(fixedExpenses.userId, userId), inArray(fixedExpenses.referenceMonth, months))
            ),

      db
        .select({ referenceMonth: investments.referenceMonth, amount: investments.amount })
        .from(investments)
        .where(
          and(
            eq(investments.userId, userId),
            inArray(investments.referenceMonth, months),
            eq(investments.excludeFromCashFlow, false)
          )
        ),

      getDekForUser(userId),
    ])

  const incomesMap = new Map<string, number>()
  for (const r of incomesRows) {
    const net =
      toAmount(decryptField(r.amount, dek)) -
      toAmount(decryptOptional(r.investmentReturnCapital, dek))
    incomesMap.set(r.referenceMonth, (incomesMap.get(r.referenceMonth) ?? 0) + net)
  }

  const transactionsMap = new Map<string, number>()
  for (const r of transactionsRows) {
    transactionsMap.set(
      r.referenceMonth,
      (transactionsMap.get(r.referenceMonth) ?? 0) + toAmount(decryptField(r.amount, dek))
    )
  }

  const fixedExpensesMap = new Map<string, number>()
  for (const r of fixedExpensesRows) {
    fixedExpensesMap.set(
      r.referenceMonth,
      (fixedExpensesMap.get(r.referenceMonth) ?? 0) + toAmount(decryptField(r.amount, dek))
    )
  }

  const investmentsMap = new Map<string, number>()
  for (const r of investmentsRows) {
    investmentsMap.set(
      r.referenceMonth,
      (investmentsMap.get(r.referenceMonth) ?? 0) + toAmount(decryptOptional(r.amount, dek))
    )
  }

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

  const [groups, allTransactions, allFixedExpenses, dek] = await Promise.all([
    db.query.categoryGroups.findMany({
      where: eq(categoryGroups.userId, userId),
      with: { categories: true },
    }),
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
    getDekForUser(userId),
  ])

  // Build a map: categoryId → { groupId, groupName }
  const categoryToGroup = new Map<string, { groupId: string; groupName: string }>()
  for (const group of groups) {
    for (const cat of group.categories) {
      categoryToGroup.set(cat.id, { groupId: group.id, groupName: decryptField(group.name, dek) })
    }
  }

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
    existing.total += toAmount(decryptField(t.amount, dek))
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
