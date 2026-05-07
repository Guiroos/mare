'use server'

import { auth } from '@/lib/auth'
import { getCategoriesWithGroups, getPaymentAccounts } from '@/lib/queries/categories'
import { getInvestmentTypes } from '@/lib/queries/investments'
import {
  getCategoryGroupProgress,
  getMonthIncomes,
  getMonthInvestments,
} from '@/lib/queries/dashboard'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as { id?: string })?.id
  if (!userId) throw new Error('Não autorizado')
  return userId
}

export async function getRegistrationFormData() {
  const session = await auth()
  const userId = requireUserId(session)
  const month = yearMonthToReferenceMonth(currentYearMonth())

  const [categoryGroups, accounts, investmentTypes, groupProgress, incomeList, investmentList] =
    await Promise.all([
      getCategoriesWithGroups(userId),
      getPaymentAccounts(userId),
      getInvestmentTypes(userId),
      getCategoryGroupProgress(userId, month),
      getMonthIncomes(userId, month),
      getMonthInvestments(userId, month),
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

  return { categoryGroups, accounts, investmentTypes, categorySpends, currentBalance }
}
