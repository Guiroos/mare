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
import {
  groupSchema,
  categorySchema,
  budgetOverrideSchema,
  accountActionSchema,
} from '@/lib/validations/categories'
import { uuidSchema, referenceMonthSchema } from '@/lib/validations/utils'

// ─── Grupos ───────────────────────────────────────────────────────────────────

export async function createCategoryGroup(name: string) {
  const userId = await requireUserId()
  groupSchema.parse({ name })
  await db.insert(categoryGroups).values({ userId, name })
  revalidatePath('/categorias')
}

export async function updateCategoryGroup(id: string, name: string) {
  const userId = await requireUserId()
  groupSchema.parse({ name })
  await db
    .update(categoryGroups)
    .set({ name })
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

function deriveBgColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mix = (ch: number) => Math.round(ch * 0.12 + 255 * 0.88)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

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

  await db.insert(categories).values({
    userId,
    name: data.name,
    groupId: data.groupId,
    defaultBudget: data.defaultBudget || null,
    color: data.color || null,
    bgColor: data.color ? deriveBgColor(data.color) : null,
  })
  revalidatePath('/categorias')
}

export async function updateCategory(id: string, data: CategoryInput) {
  const userId = await requireUserId()
  categorySchema.parse(data)

  await assertOwnsCategoryGroup(userId, data.groupId)

  await db
    .update(categories)
    .set({
      name: data.name,
      groupId: data.groupId,
      defaultBudget: data.defaultBudget || null,
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

  await db
    .insert(monthlyBudgetOverrides)
    .values({
      userId,
      categoryId: data.categoryId,
      referenceMonth: data.referenceMonth,
      amount: data.amount,
    })
    .onConflictDoUpdate({
      target: [
        monthlyBudgetOverrides.userId,
        monthlyBudgetOverrides.categoryId,
        monthlyBudgetOverrides.referenceMonth,
      ],
      set: { amount: data.amount },
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

  await db
    .delete(monthlyBudgetOverrides)
    .where(
      and(
        eq(monthlyBudgetOverrides.userId, userId),
        eq(monthlyBudgetOverrides.referenceMonth, referenceMonth)
      )
    )

  await db.insert(monthlyBudgetOverrides).values(
    prevOverrides.map((o) => ({
      userId,
      categoryId: o.categoryId,
      referenceMonth,
      amount: o.amount,
    }))
  )

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
  await db.insert(paymentAccounts).values({
    userId,
    name: data.name,
    type: data.type,
    closingDay: data.closingDay || null,
  })
  revalidatePath('/contas')
}

export async function updatePaymentAccount(id: string, data: AccountInput) {
  const userId = await requireUserId()
  accountActionSchema.parse(data)
  await db
    .update(paymentAccounts)
    .set({
      name: data.name,
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
