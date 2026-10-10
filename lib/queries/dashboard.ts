import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  investmentWithdrawals,
  categoryGroups,
  monthlyBudgetOverrides,
} from '@/lib/db/schema'
import { eq, and, or, desc, between, gte, lt, isNotNull, notInArray } from 'drizzle-orm'
import { yearMonthToReferenceMonth, prevMonth, fixedExpenseCycleCutoff } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { FaturaContext, isFaturaMonth } from '@/lib/queries/fatura'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

// ─── Gastos por grupo de categoria ───────────────────────────────────────────

export async function getCategoryGroupProgress(
  userId: string,
  referenceMonth: string,
  faturaCtx?: FaturaContext
) {
  const creditAccountIds = faturaCtx?.creditAccountIds ?? []
  const shouldFilterCredit = isFaturaMonth(referenceMonth, faturaCtx) && creditAccountIds.length > 0

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
  const [rows, withdrawalRows, dek] = await Promise.all([
    db.query.incomes.findMany({
      where: and(eq(incomes.userId, userId), eq(incomes.referenceMonth, referenceMonth)),
    }),
    db
      .select({
        incomeId: investmentWithdrawals.incomeId,
        destination: investmentWithdrawals.destination,
      })
      .from(investmentWithdrawals)
      .innerJoin(incomes, eq(investmentWithdrawals.incomeId, incomes.id))
      .where(
        and(eq(investmentWithdrawals.userId, userId), eq(incomes.referenceMonth, referenceMonth))
      ),
    getDekForUser(userId),
  ])
  // Entrada de resgate só aceita viagem com destino "caixa" (updateIncome rejeita o resto).
  // investmentReturnCapital não serve de sinal: resgates para o caixa anteriores ao
  // destino 'reinvest' (6ec05c0) também o gravavam.
  const withdrawalDestination = new Map(withdrawalRows.map((r) => [r.incomeId, r.destination]))
  return rows.map((row) => ({
    ...row,
    source: decryptField(row.source, dek),
    amount: decryptField(row.amount, dek),
    investmentReturnCapital: decryptOptional(row.investmentReturnCapital, dek),
    canLinkTrip: (withdrawalDestination.get(row.id) ?? 'income') === 'income',
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

  const creditIdSet = new Set(faturaCtx?.creditAccountIds ?? [])
  const shouldFilterCredit = isFaturaMonth(referenceMonth, faturaCtx) && creditIdSet.size > 0

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
    // Diz se o crédito ficou fora do saldo e do orçamento deste mês — o mesmo predicado
    // usado acima, exposto para a page derivar as contas "via fatura" sem reexpressá-lo.
    // transactions/fixedExpenses continuam com os itens de crédito (selo "via fatura").
    creditFilteredFromBudget: shouldFilterCredit,
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
            gte(fixedExpenses.dueDay, fixedExpenseCycleCutoff(prevMonth(yearMonth), closingDay))
          ),
          and(
            eq(fixedExpenses.referenceMonth, currRefMonth),
            lt(fixedExpenses.dueDay, fixedExpenseCycleCutoff(yearMonth, closingDay))
          )
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

  const [cycleTransactions, cycleFixedExpenses, groupProgress, incomeList, investmentList] =
    await Promise.all([
      getTransactionsByDateRange(userId, cycleRange.start, cycleRange.end, accountId),
      getFixedExpensesByBillingCycle(userId, yearMonth, closingDay, accountId),
      getCategoryGroupProgress(userId, referenceMonth),
      getMonthIncomes(userId, referenceMonth),
      getMonthInvestments(userId, referenceMonth),
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
    // groupProgress aqui é chamado sem faturaCtx (mês de calendário, todas as contas) —
    // nesta visão o crédito nunca é excluído.
    creditFilteredFromBudget: false,
    incomes: incomeList,
    investments: investmentList,
  }
}
