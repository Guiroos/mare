import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  categoryGroups,
  monthlyBudgetOverrides,
} from '@/lib/db/schema'
import { eq, and, or, desc, between, gte, lt, isNotNull, notInArray } from 'drizzle-orm'
import { yearMonthToReferenceMonth, prevMonth } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { FaturaContext } from '@/lib/queries/fatura'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

// ─── Gastos por grupo de categoria ───────────────────────────────────────────

export async function getCategoryGroupProgress(
  userId: string,
  referenceMonth: string,
  faturaCtx?: FaturaContext
) {
  const isFaturaMonth =
    faturaCtx !== undefined &&
    faturaCtx.creditMode === 'fatura' &&
    faturaCtx.faturaActiveFrom !== null &&
    referenceMonth >= faturaCtx.faturaActiveFrom

  const creditAccountIds = faturaCtx?.creditAccountIds ?? []
  const shouldFilterCredit = isFaturaMonth && creditAccountIds.length > 0

  const txWhere = shouldFilterCredit
    ? and(
        eq(transactions.userId, userId),
        eq(transactions.referenceMonth, referenceMonth),
        notInArray(transactions.accountId, creditAccountIds),
        isNotNull(transactions.categoryId)
      )
    : and(
        eq(transactions.userId, userId),
        eq(transactions.referenceMonth, referenceMonth),
        isNotNull(transactions.categoryId)
      )

  const fxWhere = shouldFilterCredit
    ? and(
        eq(fixedExpenses.userId, userId),
        eq(fixedExpenses.referenceMonth, referenceMonth),
        notInArray(fixedExpenses.accountId, creditAccountIds)
      )
    : and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth))

  const [groups, txRows, fxRows, dek] = await Promise.all([
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
      .select({ categoryId: transactions.categoryId, amount: transactions.amount })
      .from(transactions)
      .where(txWhere),
    db
      .select({ categoryId: fixedExpenses.categoryId, amount: fixedExpenses.amount })
      .from(fixedExpenses)
      .where(fxWhere),
    getDekForUser(userId),
  ])

  const spentMap = new Map<string, number>()
  for (const r of txRows) {
    if (!r.categoryId) continue
    spentMap.set(
      r.categoryId,
      (spentMap.get(r.categoryId) ?? 0) + toAmount(decryptField(r.amount, dek))
    )
  }
  for (const r of fxRows) {
    if (!r.categoryId) continue
    spentMap.set(
      r.categoryId,
      (spentMap.get(r.categoryId) ?? 0) + toAmount(decryptField(r.amount, dek))
    )
  }

  return groups.map((group) => {
    const categoryDetails = group.categories.map((cat) => {
      const override = cat.budgetOverrides[0]
      const budget = override?.amount
        ? toAmount(decryptField(override.amount, dek))
        : toAmount(decryptOptional(cat.defaultBudget, dek))
      const spent = spentMap.get(cat.id) ?? 0
      return {
        id: cat.id,
        name: decryptField(cat.name, dek),
        color: cat.color ?? undefined,
        bgColor: cat.bgColor ?? undefined,
        budget,
        spent,
      }
    })

    const totalBudget = categoryDetails.reduce((s, c) => s + c.budget, 0)
    const totalSpent = categoryDetails.reduce((s, c) => s + c.spent, 0)

    return {
      id: group.id,
      name: decryptField(group.name, dek),
      totalBudget,
      totalSpent,
      categories: categoryDetails,
    }
  })
}

// ─── Transações do mês ────────────────────────────────────────────────────────

export async function getMonthTransactions(userId: string, referenceMonth: string) {
  const [rows, dek] = await Promise.all([
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), eq(transactions.referenceMonth, referenceMonth)),
      with: { category: true, account: true, installmentGroup: true },
      orderBy: [desc(transactions.date)],
    }),
    getDekForUser(userId),
  ])
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    category: row.category ? { ...row.category, name: decryptField(row.category.name, dek) } : null,
    account: row.account ? { ...row.account, name: decryptField(row.account.name, dek) } : null,
    installmentGroup: row.installmentGroup
      ? {
          ...row.installmentGroup,
          name: decryptField(row.installmentGroup.name, dek),
          totalAmount: decryptField(row.installmentGroup.totalAmount, dek),
        }
      : null,
  }))
}

// ─── Gastos fixos do mês ─────────────────────────────────────────────────────

export async function getMonthFixedExpenses(userId: string, referenceMonth: string) {
  const [rows, dek] = await Promise.all([
    db.query.fixedExpenses.findMany({
      where: and(
        eq(fixedExpenses.userId, userId),
        eq(fixedExpenses.referenceMonth, referenceMonth)
      ),
      with: { category: true, account: true },
      orderBy: [fixedExpenses.dueDay],
    }),
    getDekForUser(userId),
  ])
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    category: row.category ? { ...row.category, name: decryptField(row.category.name, dek) } : null,
    account: row.account ? { ...row.account, name: decryptField(row.account.name, dek) } : null,
  }))
}

// ─── Entradas do mês ─────────────────────────────────────────────────────────

export async function getMonthIncomes(userId: string, referenceMonth: string) {
  const [rows, dek] = await Promise.all([
    db.query.incomes.findMany({
      where: and(eq(incomes.userId, userId), eq(incomes.referenceMonth, referenceMonth)),
    }),
    getDekForUser(userId),
  ])
  return rows.map((row) => ({
    ...row,
    source: decryptField(row.source, dek),
    amount: decryptField(row.amount, dek),
    investmentReturnCapital: decryptOptional(row.investmentReturnCapital, dek),
  }))
}

// ─── Investimentos do mês ────────────────────────────────────────────────────

export async function getMonthInvestments(userId: string, referenceMonth: string) {
  const [rows, dek] = await Promise.all([
    db.query.investments.findMany({
      where: and(eq(investments.userId, userId), eq(investments.referenceMonth, referenceMonth)),
      with: { investmentType: true },
    }),
    getDekForUser(userId),
  ])
  return rows.map((row) => ({
    ...row,
    amount: decryptOptional(row.amount, dek),
    yieldAmount: decryptOptional(row.yieldAmount, dek),
    notes: decryptOptional(row.notes, dek),
    investmentType: { ...row.investmentType, name: decryptField(row.investmentType.name, dek) },
  }))
}

// ─── Dados completos do dashboard (single call) ───────────────────────────────
// Totais calculados a partir dos dados já buscados — sem queries de SUM separadas.

export async function getDashboardData(
  userId: string,
  referenceMonth: string,
  faturaCtx?: FaturaContext
) {
  const [groupProgress, monthTransactions, fixedExpenseList, incomeList, investmentList] =
    await Promise.all([
      getCategoryGroupProgress(userId, referenceMonth, faturaCtx),
      getMonthTransactions(userId, referenceMonth),
      getMonthFixedExpenses(userId, referenceMonth),
      getMonthIncomes(userId, referenceMonth),
      getMonthInvestments(userId, referenceMonth),
    ])

  const isFaturaMonth =
    faturaCtx !== undefined &&
    faturaCtx.creditMode === 'fatura' &&
    faturaCtx.faturaActiveFrom !== null &&
    referenceMonth >= faturaCtx.faturaActiveFrom

  const creditIdSet = new Set(faturaCtx?.creditAccountIds ?? [])
  const shouldFilterCredit = isFaturaMonth && creditIdSet.size > 0

  const expenseTransactions = shouldFilterCredit
    ? monthTransactions.filter((t) => !creditIdSet.has(t.accountId))
    : monthTransactions

  const expenseFixedExpenses = shouldFilterCredit
    ? fixedExpenseList.filter((e) => !creditIdSet.has(e.accountId))
    : fixedExpenseList

  const totalIncomes = incomeList.reduce(
    (s, i) =>
      s +
      toAmount(i.amount) -
      (i.investmentReturnCapital ? toAmount(i.investmentReturnCapital) : 0),
    0
  )
  const totalExpenses =
    expenseTransactions.reduce((s, t) => s + toAmount(t.amount), 0) +
    expenseFixedExpenses.reduce((s, e) => s + toAmount(e.amount), 0)
  const totalInvested = investmentList
    .filter((i) => !i.excludeFromCashFlow)
    .reduce((s, i) => s + toAmount(i.amount), 0)
  const balance = totalIncomes - totalExpenses - totalInvested
  const totalBudget = groupProgress.reduce((s, g) => s + g.totalBudget, 0)
  const totalSpent = groupProgress.reduce((s, g) => s + g.totalSpent, 0)

  return {
    summary: { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent },
    groupProgress,
    transactions: monthTransactions,
    fixedExpenses: fixedExpenseList,
    budgetTransactions: expenseTransactions,
    budgetFixedExpenses: expenseFixedExpenses,
    incomes: incomeList,
    investments: investmentList,
  }
}

// ─── Billing cycle queries ────────────────────────────────────────────────────

export async function getTransactionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
  accountId?: string
) {
  const [rows, dek] = await Promise.all([
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        between(transactions.date, startDate, endDate),
        accountId ? eq(transactions.accountId, accountId) : undefined
      ),
      with: { category: true, account: true, installmentGroup: true },
      orderBy: [desc(transactions.date)],
    }),
    getDekForUser(userId),
  ])
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    category: row.category ? { ...row.category, name: decryptField(row.category.name, dek) } : null,
    account: row.account ? { ...row.account, name: decryptField(row.account.name, dek) } : null,
    installmentGroup: row.installmentGroup
      ? {
          ...row.installmentGroup,
          name: decryptField(row.installmentGroup.name, dek),
          totalAmount: decryptField(row.installmentGroup.totalAmount, dek),
        }
      : null,
  }))
}

export async function getFixedExpensesByBillingCycle(
  userId: string,
  yearMonth: string,
  closingDay: number,
  accountId?: string
) {
  const currRefMonth = yearMonthToReferenceMonth(yearMonth)
  const prevRefMonth = yearMonthToReferenceMonth(prevMonth(yearMonth))

  const [rows, dek] = await Promise.all([
    db.query.fixedExpenses.findMany({
      where: and(
        eq(fixedExpenses.userId, userId),
        accountId ? eq(fixedExpenses.accountId, accountId) : undefined,
        or(
          and(
            eq(fixedExpenses.referenceMonth, prevRefMonth),
            gte(fixedExpenses.dueDay, closingDay)
          ),
          and(eq(fixedExpenses.referenceMonth, currRefMonth), lt(fixedExpenses.dueDay, closingDay))
        )
      ),
      with: { category: true, account: true },
      orderBy: [fixedExpenses.dueDay],
    }),
    getDekForUser(userId),
  ])
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    category: row.category ? { ...row.category, name: decryptField(row.category.name, dek) } : null,
    account: row.account ? { ...row.account, name: decryptField(row.account.name, dek) } : null,
  }))
}

export async function getDashboardDataBillingCycle(
  userId: string,
  yearMonth: string,
  closingDay: number,
  cycleRange: { start: string; end: string },
  accountId?: string
) {
  const referenceMonth = yearMonthToReferenceMonth(yearMonth)

  const [
    cycleTransactions,
    cycleFixedExpenses,
    groupProgress,
    incomeList,
    investmentList,
    monthTransactions,
    monthFixedExpenses,
  ] = await Promise.all([
    getTransactionsByDateRange(userId, cycleRange.start, cycleRange.end, accountId),
    getFixedExpensesByBillingCycle(userId, yearMonth, closingDay, accountId),
    getCategoryGroupProgress(userId, referenceMonth),
    getMonthIncomes(userId, referenceMonth),
    getMonthInvestments(userId, referenceMonth),
    getMonthTransactions(userId, referenceMonth),
    getMonthFixedExpenses(userId, referenceMonth),
  ])

  const totalExpenses =
    cycleTransactions.reduce((s, t) => s + toAmount(t.amount), 0) +
    cycleFixedExpenses.reduce((s, e) => s + toAmount(e.amount), 0)
  const totalIncomes = incomeList.reduce(
    (s, i) =>
      s +
      toAmount(i.amount) -
      (i.investmentReturnCapital ? toAmount(i.investmentReturnCapital) : 0),
    0
  )
  const totalInvested = investmentList
    .filter((i) => !i.excludeFromCashFlow)
    .reduce((s, i) => s + toAmount(i.amount), 0)
  const balance = totalIncomes - totalExpenses - totalInvested
  const totalBudget = groupProgress.reduce((s, g) => s + g.totalBudget, 0)
  const totalSpent = groupProgress.reduce((s, g) => s + g.totalSpent, 0)

  return {
    summary: { totalIncomes, totalExpenses, totalInvested, balance, totalBudget, totalSpent },
    groupProgress,
    transactions: cycleTransactions,
    fixedExpenses: cycleFixedExpenses,
    budgetTransactions: monthTransactions,
    budgetFixedExpenses: monthFixedExpenses,
    incomes: incomeList,
    investments: investmentList,
  }
}
