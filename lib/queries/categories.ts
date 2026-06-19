import { db } from '@/lib/db'
import { categoryGroups, monthlyBudgetOverrides, paymentAccounts } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

export async function getCategoriesWithGroups(userId: string) {
  const dek = await getDekForUser(userId)
  const groups = await db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: { categories: true },
    orderBy: [categoryGroups.sortOrder, categoryGroups.name],
  })

  return groups.map((group) => ({
    ...group,
    name: decryptField(group.name, dek),
    categories: group.categories.map((cat) => ({
      ...cat,
      name: decryptField(cat.name, dek),
      defaultBudget: decryptOptional(cat.defaultBudget, dek),
    })),
  }))
}

export async function getPaymentAccounts(userId: string) {
  const dek = await getDekForUser(userId)
  const rows = await db.query.paymentAccounts.findMany({
    where: eq(paymentAccounts.userId, userId),
    orderBy: [paymentAccounts.name],
  })
  return rows.map((r) => ({ ...r, name: decryptField(r.name, dek) }))
}

export async function getCreditAccounts(
  userId: string
): Promise<{ id: string; name: string; closingDay: number }[]> {
  const dek = await getDekForUser(userId)
  const rows = await db
    .select({
      id: paymentAccounts.id,
      name: paymentAccounts.name,
      closingDay: paymentAccounts.closingDay,
    })
    .from(paymentAccounts)
    .where(
      and(
        eq(paymentAccounts.userId, userId),
        eq(paymentAccounts.type, 'credit'),
        gt(paymentAccounts.closingDay, 1)
      )
    )
    .orderBy(paymentAccounts.name)
  return rows.map((r) => ({
    id: r.id,
    name: decryptField(r.name, dek),
    closingDay: r.closingDay as number,
  }))
}

export async function getCategoriesWithBudgets(userId: string, referenceMonth: string) {
  const dek = await getDekForUser(userId)
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
    name: decryptField(group.name, dek),
    categories: group.categories.map((cat) => ({
      id: cat.id,
      name: decryptField(cat.name, dek),
      defaultBudget: decryptOptional(cat.defaultBudget, dek),
      override: cat.budgetOverrides[0]
        ? {
            ...cat.budgetOverrides[0],
            amount: decryptField(cat.budgetOverrides[0].amount, dek),
          }
        : null,
    })),
  }))
}
