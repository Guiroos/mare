'use server'

import { getCategoriesWithGroups, getPaymentAccounts } from '@/lib/queries/categories'
import { getInvestmentTypes, getInvestmentBalances } from '@/lib/queries/investments'
import {
  getCategoryGroupProgress,
  getMonthIncomes,
  getMonthInvestments,
} from '@/lib/queries/dashboard'
import { getActivePeople } from '@/lib/queries/debtors'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { requireUserId } from '@/lib/auth/require-user'

export async function getRegistrationFormData() {
  const userId = await requireUserId()
  const month = yearMonthToReferenceMonth(currentYearMonth())

  const [
    categoryGroups,
    accounts,
    investmentTypes,
    groupProgress,
    incomeList,
    investmentList,
    people,
    balances,
  ] = await Promise.all([
    getCategoriesWithGroups(userId),
    getPaymentAccounts(userId),
    getInvestmentTypes(userId),
    getCategoryGroupProgress(userId, month),
    getMonthIncomes(userId, month),
    getMonthInvestments(userId, month),
    getActivePeople(userId),
    getInvestmentBalances(userId),
  ])

  const totalIncomes = incomeList.reduce((s, i) => s + toAmount(i.amount), 0)
  const totalExpenses = groupProgress.reduce((s, g) => s + g.totalSpent, 0)
  const totalInvested = investmentList
    .filter((i) => !i.excludeFromCashFlow)
    .reduce((s, i) => s + toAmount(i.amount), 0)
  const currentBalance = totalIncomes - totalExpenses - totalInvested

  const categorySpends = Object.fromEntries(
    groupProgress.flatMap((g) =>
      g.categories.map((c) => [c.id, { budget: c.budget, spent: c.spent, name: c.name }])
    )
  )

  const investmentBalances = Object.fromEntries(balances.map((b) => [b.id, b.currentBalance]))

  return {
    categoryGroups,
    accounts,
    investmentTypes,
    categorySpends,
    currentBalance,
    people,
    investmentBalances,
  }
}
