import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  categoryGroups,
  monthlyBudgetOverrides,
} from '@/lib/db/schema'
import { eq, and, or, sum, desc, between, gte, lt, inArray } from 'drizzle-orm'
import { pastNMonths, yearMonthToReferenceMonth, prevMonth } from '@/lib/utils/date'

// ─── Gastos por grupo de categoria ───────────────────────────────────────────

export async function getCategoryGroupProgress(userId: string, referenceMonth: string) {
  // 3 queries em paralelo — sem waterfall
  const [groups, spentByCategory, fixedByCategory] = await Promise.all([
    db.query.categoryGroups.findMany({
      where: eq(categoryGroups.userId, userId),
      with: {
        categories: {
          with: {
            budgetOverrides: {
              where: eq(monthlyBudgetOverrides.referenceMonth, referenceMonth),
            },
          },
        },
      },
    }),
    db
      .select({ categoryId: transactions.categoryId, total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.referenceMonth, referenceMonth)))
      .groupBy(transactions.categoryId),
    db
      .select({ categoryId: fixedExpenses.categoryId, total: sum(fixedExpenses.amount) })
      .from(fixedExpenses)
      .where(
        and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth))
      )
      .groupBy(fixedExpenses.categoryId),
  ])

  const spentMap = new Map<string, number>()
  for (const r of spentByCategory) {
    spentMap.set(r.categoryId, (spentMap.get(r.categoryId) ?? 0) + Number(r.total ?? 0))
  }
  for (const r of fixedByCategory) {
    spentMap.set(r.categoryId, (spentMap.get(r.categoryId) ?? 0) + Number(r.total ?? 0))
  }

  return groups.map((group) => {
    const categoryDetails = group.categories.map((cat) => {
      const override = cat.budgetOverrides[0]
      const budget = Number(override?.amount ?? cat.defaultBudget ?? 0)
      const spent = spentMap.get(cat.id) ?? 0
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color ?? undefined,
        bgColor: cat.bgColor ?? undefined,
        budget,
        spent,
      }
    })

    const totalBudget = categoryDetails.reduce((s, c) => s + c.budget, 0)
    const totalSpent = categoryDetails.reduce((s, c) => s + c.spent, 0)

    return { id: group.id, name: group.name, totalBudget, totalSpent, categories: categoryDetails }
  })
}

// ─── Transações do mês ────────────────────────────────────────────────────────

export async function getMonthTransactions(userId: string, referenceMonth: string) {
  return db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.referenceMonth, referenceMonth)),
    with: { category: true, account: true, installmentGroup: true },
    orderBy: [desc(transactions.date)],
  })
}

// ─── Gastos fixos do mês ─────────────────────────────────────────────────────

export async function getMonthFixedExpenses(userId: string, referenceMonth: string) {
  return db.query.fixedExpenses.findMany({
    where: and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth)),
    with: { category: true, account: true },
    orderBy: [fixedExpenses.dueDay],
  })
}

// ─── Entradas do mês ─────────────────────────────────────────────────────────

export async function getMonthIncomes(userId: string, referenceMonth: string) {
  return db.query.incomes.findMany({
    where: and(eq(incomes.userId, userId), eq(incomes.referenceMonth, referenceMonth)),
    orderBy: [desc(incomes.amount)],
  })
}

// ─── Investimentos do mês ────────────────────────────────────────────────────

export async function getMonthInvestments(userId: string, referenceMonth: string) {
  return db.query.investments.findMany({
    where: and(eq(investments.userId, userId), eq(investments.referenceMonth, referenceMonth)),
    with: { investmentType: true },
  })
}

// ─── Dados completos do dashboard (single call) ───────────────────────────────
// Totais calculados a partir dos dados já buscados — sem queries de SUM separadas.

export async function getDashboardData(userId: string, referenceMonth: string) {
  const [
    groupProgress,
    monthTransactions,
    fixedExpenseList,
    incomeList,
    investmentList,
    monthlyEvolutionData,
  ] = await Promise.all([
    getCategoryGroupProgress(userId, referenceMonth),
    getMonthTransactions(userId, referenceMonth),
    getMonthFixedExpenses(userId, referenceMonth),
    getMonthIncomes(userId, referenceMonth),
    getMonthInvestments(userId, referenceMonth),
    getMonthlyEvolution(userId),
  ])

  const totalIncomes = incomeList.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses =
    monthTransactions.reduce((s, t) => s + Number(t.amount), 0) +
    fixedExpenseList.reduce((s, e) => s + Number(e.amount), 0)
  const totalInvested = investmentList.reduce((s, i) => s + Number(i.amount), 0)
  const balance = totalIncomes - totalExpenses - totalInvested
  const totalBudget = groupProgress.reduce((s, g) => s + g.totalBudget, 0)
  const totalSpent = groupProgress.reduce((s, g) => s + g.totalSpent, 0)

  return {
    summary: { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent },
    groupProgress,
    transactions: monthTransactions,
    fixedExpenses: fixedExpenseList,
    incomes: incomeList,
    investments: investmentList,
    monthlyEvolution: monthlyEvolutionData,
  }
}

// ─── Billing cycle queries ────────────────────────────────────────────────────

export async function getTransactionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  return db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), between(transactions.date, startDate, endDate)),
    with: { category: true, account: true, installmentGroup: true },
    orderBy: [desc(transactions.date)],
  })
}

export async function getFixedExpensesByBillingCycle(
  userId: string,
  yearMonth: string,
  closingDay: number
) {
  const currRefMonth = yearMonthToReferenceMonth(yearMonth)
  const prevRefMonth = yearMonthToReferenceMonth(prevMonth(yearMonth))

  return db.query.fixedExpenses.findMany({
    where: and(
      eq(fixedExpenses.userId, userId),
      or(
        and(eq(fixedExpenses.referenceMonth, prevRefMonth), gte(fixedExpenses.dueDay, closingDay)),
        and(eq(fixedExpenses.referenceMonth, currRefMonth), lt(fixedExpenses.dueDay, closingDay))
      )
    ),
    with: { category: true, account: true },
    orderBy: [fixedExpenses.dueDay],
  })
}

export async function getDashboardDataBillingCycle(
  userId: string,
  yearMonth: string,
  closingDay: number,
  cycleRange: { start: string; end: string }
) {
  const referenceMonth = yearMonthToReferenceMonth(yearMonth)

  const [
    cycleTransactions,
    cycleFixedExpenses,
    groupProgress,
    incomeList,
    investmentList,
    monthlyEvolutionData,
  ] = await Promise.all([
    getTransactionsByDateRange(userId, cycleRange.start, cycleRange.end),
    getFixedExpensesByBillingCycle(userId, yearMonth, closingDay),
    getCategoryGroupProgress(userId, referenceMonth),
    getMonthIncomes(userId, referenceMonth),
    getMonthInvestments(userId, referenceMonth),
    getMonthlyEvolution(userId),
  ])

  const totalExpenses =
    cycleTransactions.reduce((s, t) => s + Number(t.amount), 0) +
    cycleFixedExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalIncomes = incomeList.reduce((s, i) => s + Number(i.amount), 0)
  const totalInvested = investmentList.reduce((s, i) => s + Number(i.amount), 0)
  const balance = totalIncomes - totalExpenses - totalInvested
  const totalBudget = groupProgress.reduce((s, g) => s + g.totalBudget, 0)
  const totalSpent = groupProgress.reduce((s, g) => s + g.totalSpent, 0)

  return {
    summary: { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent },
    groupProgress,
    transactions: cycleTransactions,
    fixedExpenses: cycleFixedExpenses,
    incomes: incomeList,
    investments: investmentList,
    monthlyEvolution: monthlyEvolutionData,
  }
}

// ─── Evolução mensal (últimos N meses) ────────────────────────────────────────
// 4 queries com IN + GROUP BY em vez de N×4 queries sequenciais.

export async function getMonthlyEvolution(userId: string, monthsBack: number = 6) {
  const months = pastNMonths(monthsBack)

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

  return months.map((refMonth) => ({
    month: refMonth.slice(0, 7),
    totalIncomes: incomesMap.get(refMonth) ?? 0,
    totalExpenses: (transactionsMap.get(refMonth) ?? 0) + (fixedExpensesMap.get(refMonth) ?? 0),
    totalInvested: investmentsMap.get(refMonth) ?? 0,
  }))
}
