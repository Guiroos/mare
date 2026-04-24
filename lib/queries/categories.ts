import { db } from '@/lib/db'
import { categoryGroups, monthlyBudgetOverrides, paymentAccounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getCategoriesWithGroups(userId: string) {
  return db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: { categories: true },
    orderBy: [categoryGroups.sortOrder, categoryGroups.name],
  })
}

export async function getPaymentAccounts(userId: string) {
  return db.query.paymentAccounts.findMany({
    where: eq(paymentAccounts.userId, userId),
    orderBy: [paymentAccounts.name],
  })
}

export async function getCategoriesWithBudgets(userId: string, referenceMonth: string) {
  const groups = await db.query.categoryGroups.findMany({
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
    orderBy: [categoryGroups.sortOrder, categoryGroups.name],
  })

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    categories: group.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      defaultBudget: cat.defaultBudget,
      override: cat.budgetOverrides[0] ?? null,
    })),
  }))
}
