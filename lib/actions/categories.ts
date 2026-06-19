'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  categoryGroups,
  categories,
  monthlyBudgetOverrides,
  paymentAccounts,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsCategoryGroup, assertOwnsCategory } from '@/lib/auth/ownership'
import { deriveBgColor } from '@/lib/utils/color'
import {
  groupSchema,
  categorySchema,
  budgetOverrideSchema,
  accountActionSchema,
} from '@/lib/validations/categories'
import { uuidSchema, referenceMonthSchema } from '@/lib/validations/utils'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'

// ─── Grupos ───────────────────────────────────────────────────────────────────

export async function createCategoryGroup(name: string) {
  const userId = await requireUserId()
  groupSchema.parse({ name })
  const dek = await getDekForUser(userId)
  await db.insert(categoryGroups).values({ userId, name: encryptField(name, dek) })
  revalidatePath('/categorias')
}

export async function updateCategoryGroup(id: string, name: string) {
  const userId = await requireUserId()
  groupSchema.parse({ name })
  const dek = await getDekForUser(userId)
  await db
    .update(categoryGroups)
    .set({ name: encryptField(name, dek) })
    .where(and(eq(categoryGroups.id, id), eq(categoryGroups.userId, userId)))
  revalidatePath('/categorias')
}

export async function deleteCategoryGroup(id: string) {
  const userId = await requireUserId()
  await db
    .delete(categoryGroups)
    .where(and(eq(categoryGroups.id, id), eq(categoryGroups.userId, userId)))
  revalidatePath('/categorias')
}

export async function reorderCategoryGroups(orderedIds: string[]) {
  const userId = await requireUserId()
  z.array(uuidSchema).parse(orderedIds)
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(categoryGroups)
        .set({ sortOrder: index })
        .where(and(eq(categoryGroups.id, id), eq(categoryGroups.userId, userId)))
    )
  )
  revalidatePath('/categorias')
}

// ─── Categorias ───────────────────────────────────────────────────────────────

export type CategoryInput = {
  name: string
  groupId: string
  defaultBudget?: string | null
  color?: string
}

export async function createCategory(data: CategoryInput) {
  const userId = await requireUserId()
  categorySchema.parse(data)

  await assertOwnsCategoryGroup(userId, data.groupId)

  const dek = await getDekForUser(userId)
  await db.insert(categories).values({
    userId,
    name: encryptField(data.name, dek),
    groupId: data.groupId,
    defaultBudget: encryptOptional(data.defaultBudget || null, dek),
    color: data.color || null,
    bgColor: data.color ? deriveBgColor(data.color) : null,
  })
  revalidatePath('/categorias')
}

export async function updateCategory(id: string, data: CategoryInput) {
  const userId = await requireUserId()
  categorySchema.parse(data)

  await assertOwnsCategoryGroup(userId, data.groupId)

  const dek = await getDekForUser(userId)
  await db
    .update(categories)
    .set({
      name: encryptField(data.name, dek),
      groupId: data.groupId,
      defaultBudget: encryptOptional(data.defaultBudget || null, dek),
      color: data.color || null,
      bgColor: data.color ? deriveBgColor(data.color) : null,
    })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  revalidatePath('/categorias')
  revalidatePath('/dashboard')
}

export async function deleteCategory(id: string) {
  const userId = await requireUserId()
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)))
  revalidatePath('/categorias')
}

// ─── Overrides de orçamento mensal ───────────────────────────────────────────

export async function upsertBudgetOverride(data: {
  categoryId: string
  referenceMonth: string
  amount: string
}) {
  const userId = await requireUserId()
  budgetOverrideSchema.parse({ amount: data.amount })
  referenceMonthSchema.parse(data.referenceMonth)

  await assertOwnsCategory(userId, data.categoryId)

  const dek = await getDekForUser(userId)
  const encryptedAmount = encryptField(data.amount, dek)

  await db
    .insert(monthlyBudgetOverrides)
    .values({
      userId,
      categoryId: data.categoryId,
      referenceMonth: data.referenceMonth,
      amount: encryptedAmount,
    })
    .onConflictDoUpdate({
      target: [
        monthlyBudgetOverrides.userId,
        monthlyBudgetOverrides.categoryId,
        monthlyBudgetOverrides.referenceMonth,
      ],
      set: { amount: encryptedAmount },
    })

  revalidatePath('/configuracao-mes')
  revalidatePath('/dashboard')
}

export async function deleteBudgetOverride(id: string) {
  const userId = await requireUserId()
  await db
    .delete(monthlyBudgetOverrides)
    .where(and(eq(monthlyBudgetOverrides.id, id), eq(monthlyBudgetOverrides.userId, userId)))
  revalidatePath('/configuracao-mes')
  revalidatePath('/dashboard')
}

export async function copyBudgetOverridesFromPrevMonth(
  referenceMonth: string,
  prevReferenceMonth: string
) {
  const userId = await requireUserId()
  referenceMonthSchema.parse(referenceMonth)
  referenceMonthSchema.parse(prevReferenceMonth)

  const prevOverrides = await db.query.monthlyBudgetOverrides.findMany({
    where: and(
      eq(monthlyBudgetOverrides.userId, userId),
      eq(monthlyBudgetOverrides.referenceMonth, prevReferenceMonth)
    ),
  })

  if (prevOverrides.length === 0) return { copied: 0 }

  await db.transaction(async (tx) => {
    await tx
      .delete(monthlyBudgetOverrides)
      .where(
        and(
          eq(monthlyBudgetOverrides.userId, userId),
          eq(monthlyBudgetOverrides.referenceMonth, referenceMonth)
        )
      )

    await tx.insert(monthlyBudgetOverrides).values(
      prevOverrides.map((o) => ({
        userId,
        categoryId: o.categoryId,
        referenceMonth,
        amount: o.amount,
      }))
    )
  })

  revalidatePath('/configuracao-mes')
  revalidatePath('/dashboard')
  return { copied: prevOverrides.length }
}

// ─── Contas de pagamento ──────────────────────────────────────────────────────

export type AccountInput = {
  name: string
  type: string
  closingDay?: number
}

export async function createPaymentAccount(data: AccountInput) {
  const userId = await requireUserId()
  accountActionSchema.parse(data)
  const dek = await getDekForUser(userId)
  await db.insert(paymentAccounts).values({
    userId,
    name: encryptField(data.name, dek),
    type: data.type,
    closingDay: data.closingDay || null,
  })
  revalidatePath('/contas')
}

export async function updatePaymentAccount(id: string, data: AccountInput) {
  const userId = await requireUserId()
  accountActionSchema.parse(data)
  const dek = await getDekForUser(userId)
  await db
    .update(paymentAccounts)
    .set({
      name: encryptField(data.name, dek),
      type: data.type,
      closingDay: data.closingDay || null,
    })
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId)))
  revalidatePath('/contas')
}

export async function deletePaymentAccount(id: string) {
  const userId = await requireUserId()
  await db
    .delete(paymentAccounts)
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId)))
  revalidatePath('/contas')
}
