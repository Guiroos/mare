import { db } from '@/lib/db'
import {
  categories,
  categoryGroups,
  monthlyBudgetOverrides,
  paymentAccounts,
} from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'

export async function getCategoriesWithGroups(userId: string) {
  const dek = await getDekForUser(userId)
  const groups = await db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: { categories: true },
    orderBy: [categoryGroups.sortOrder],
  })

  return groups
    .sort((a, b) => decryptField(a.name, dek).localeCompare(decryptField(b.name, dek), 'pt-BR'))
    .map((group) => ({
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
  })
  return rows
    .map((r) => ({ ...r, name: decryptField(r.name, dek) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
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
  return rows
    .map((r) => ({
      id: r.id,
      name: decryptField(r.name, dek),
      closingDay: r.closingDay as number,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
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
    orderBy: [categoryGroups.sortOrder],
  })

  return groups
    .sort((a, b) => decryptField(a.name, dek).localeCompare(decryptField(b.name, dek), 'pt-BR'))
    .map((group) => ({
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

/**
 * Todos os overrides de orçamento, de todos os meses. getCategoriesWithBudgets
 * é por mês; a exportação completa precisa da série inteira para permitir
 * reconstruir o orçamento fora do app.
 */
export async function getAllBudgetOverrides(userId: string) {
  const [rows, dek] = await Promise.all([
    db
      .select({
        referenceMonth: monthlyBudgetOverrides.referenceMonth,
        amount: monthlyBudgetOverrides.amount,
        categoryName: categories.name,
        groupName: categoryGroups.name,
      })
      .from(monthlyBudgetOverrides)
      .innerJoin(categories, eq(monthlyBudgetOverrides.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(eq(monthlyBudgetOverrides.userId, userId)),
    getDekForUser(userId),
  ])

  return rows
    .map((r) => ({
      referenceMonth: r.referenceMonth,
      groupName: decryptField(r.groupName, dek),
      categoryName: decryptField(r.categoryName, dek),
      amount: toAmount(decryptField(r.amount, dek)),
    }))
    .sort(
      (a, b) =>
        a.referenceMonth.localeCompare(b.referenceMonth) ||
        a.categoryName.localeCompare(b.categoryName, 'pt-BR')
    )
}

export type BudgetOverrideRow = Awaited<ReturnType<typeof getAllBudgetOverrides>>[number]
