'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  categoryGroups,
  categories,
  monthlyBudgetOverrides,
  paymentAccounts,
} from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { eq, and } from 'drizzle-orm'

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as { id?: string })?.id
  if (!userId) throw new Error('Não autorizado')
  return userId
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

export async function createCategoryGroup(name: string) {
  const session = await auth()
  const userId = requireUserId(session)
  await db.insert(categoryGroups).values({ userId, name })
  revalidatePath('/categorias')
}

export async function updateCategoryGroup(id: string, name: string) {
  const session = await auth()
  const userId = requireUserId(session)
  await db
    .update(categoryGroups)
    .set({ name })
    .where(and(eq(categoryGroups.id, id), eq(categoryGroups.userId, userId)))
  revalidatePath('/categorias')
}

export async function deleteCategoryGroup(id: string) {
  const session = await auth()
  const userId = requireUserId(session)
  await db
    .delete(categoryGroups)
    .where(and(eq(categoryGroups.id, id), eq(categoryGroups.userId, userId)))
  revalidatePath('/categorias')
}

export async function reorderCategoryGroups(orderedIds: string[]) {
  const session = await auth()
  const userId = requireUserId(session)
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
  defaultBudget?: string
  color?: string
}

export async function createCategory(data: CategoryInput) {
  const session = await auth()
  const userId = requireUserId(session)
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
  const session = await auth()
  const userId = requireUserId(session)
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
  const session = await auth()
  const userId = requireUserId(session)
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)))
  revalidatePath('/categorias')
}

// ─── Overrides de orçamento mensal ───────────────────────────────────────────

export async function upsertBudgetOverride(data: {
  categoryId: string
  referenceMonth: string
  amount: string
  existingId?: string
}) {
  const session = await auth()
  const userId = requireUserId(session)

  if (data.existingId) {
    await db
      .update(monthlyBudgetOverrides)
      .set({ amount: data.amount })
      .where(
        and(
          eq(monthlyBudgetOverrides.id, data.existingId),
          eq(monthlyBudgetOverrides.userId, userId)
        )
      )
  } else {
    await db.insert(monthlyBudgetOverrides).values({
      userId,
      categoryId: data.categoryId,
      referenceMonth: data.referenceMonth,
      amount: data.amount,
    })
  }

  revalidatePath('/configuracao-mes')
  revalidatePath('/dashboard')
}

export async function deleteBudgetOverride(id: string) {
  const session = await auth()
  const userId = requireUserId(session)
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
  const session = await auth()
  const userId = requireUserId(session)

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
  const session = await auth()
  const userId = requireUserId(session)
  await db.insert(paymentAccounts).values({
    userId,
    name: data.name,
    type: data.type,
    closingDay: data.closingDay || null,
  })
  revalidatePath('/categorias')
}

export async function updatePaymentAccount(id: string, data: AccountInput) {
  const session = await auth()
  const userId = requireUserId(session)
  await db
    .update(paymentAccounts)
    .set({
      name: data.name,
      type: data.type,
      closingDay: data.closingDay || null,
    })
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId)))
  revalidatePath('/categorias')
}

export async function deletePaymentAccount(id: string) {
  const session = await auth()
  const userId = requireUserId(session)
  await db
    .delete(paymentAccounts)
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId)))
  revalidatePath('/categorias')
}
