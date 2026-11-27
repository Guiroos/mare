'use server'

import {
  getCategoriesWithGroups,
  getPaymentAccounts,
  getCreditAccounts,
} from '@/lib/queries/categories'
import { getInvestmentTypes, getInvestmentBalances } from '@/lib/queries/investments'
import { getDashboardData } from '@/lib/queries/dashboard'
import { getUserCreditMode, isFaturaMonth } from '@/lib/queries/fatura'
import { getActivePeople } from '@/lib/queries/debtors'
import { getActiveTrips } from '@/lib/queries/trips'
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { requireUserId } from '@/lib/auth/require-user'

export async function getRegistrationFormData() {
  const userId = await requireUserId()
  const month = yearMonthToReferenceMonth(currentYearMonth())

  const [creditAccounts, creditMode] = await Promise.all([
    getCreditAccounts(userId),
    getUserCreditMode(userId),
  ])

  const faturaCtx =
    creditMode.creditMode === 'fatura'
      ? {
          creditMode: creditMode.creditMode,
          faturaActiveFrom: creditMode.faturaActiveFrom,
          creditAccountIds: creditAccounts.map((a) => a.id),
        }
      : undefined

  const [categoryGroups, accounts, investmentTypes, people, balances, dashboardData, trips] =
    await Promise.all([
      getCategoriesWithGroups(userId),
      getPaymentAccounts(userId),
      getInvestmentTypes(userId),
      getActivePeople(userId),
      getInvestmentBalances(userId),
      getDashboardData(userId, month, faturaCtx),
      getActiveTrips(userId),
    ])

  const { groupProgress, summary } = dashboardData

  const categorySpends = Object.fromEntries(
    groupProgress.flatMap((g) =>
      g.categories.map((c) => [c.id, { budget: c.budget, spent: c.spent, name: c.name }])
    )
  )

  const investmentBalances = Object.fromEntries(balances.map((b) => [b.id, b.currentBalance]))
  // Total aportado por tipo — base do capital de um resgate por rolagem
  const investmentCapitals = Object.fromEntries(balances.map((b) => [b.id, b.totalAmount]))

  // Cartões cuja compra não move o saldo do mês: mesmo predicado de getDashboardData
  // (mês sob fatura e ao menos uma conta de crédito). Vazio fora do regime.
  const viaFaturaAccountIds = isFaturaMonth(month, faturaCtx)
    ? (faturaCtx?.creditAccountIds ?? [])
    : []

  return {
    categoryGroups,
    accounts,
    investmentTypes,
    categorySpends,
    currentBalance: summary.balance,
    people,
    investmentBalances,
    investmentCapitals,
    viaFaturaAccountIds,
    trips,
  }
}
