import { db } from '@/lib/db'
import {
  categoryGroups,
  categories,
  paymentAccounts,
  investmentTypes,
  goals,
  people,
  debtorEntries,
} from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

function unauthorized(): never {
  throw new Error('Não autorizado')
}

export async function assertOwnsCategoryGroup(userId: string, groupId: string): Promise<void> {
  const [row] = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(and(eq(categoryGroups.id, groupId), eq(categoryGroups.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}

export async function assertOwnsCategory(userId: string, categoryId: string): Promise<void> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}

export async function assertOwnsPaymentAccount(userId: string, accountId: string): Promise<void> {
  const [row] = await db
    .select({ id: paymentAccounts.id })
    .from(paymentAccounts)
    .where(and(eq(paymentAccounts.id, accountId), eq(paymentAccounts.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}

export async function assertOwnsInvestmentType(
  userId: string,
  investmentTypeId: string
): Promise<void> {
  const [row] = await db
    .select({ id: investmentTypes.id })
    .from(investmentTypes)
    .where(and(eq(investmentTypes.id, investmentTypeId), eq(investmentTypes.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}

export async function assertOwnsGoal(userId: string, goalId: string): Promise<void> {
  const [row] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}

export async function assertOwnsPerson(userId: string, personId: string): Promise<void> {
  const [row] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.id, personId), eq(people.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}

export async function assertOwnsDebtEntry(userId: string, entryId: string): Promise<void> {
  const [row] = await db
    .select({ id: debtorEntries.id })
    .from(debtorEntries)
    .where(and(eq(debtorEntries.id, entryId), eq(debtorEntries.userId, userId)))
    .limit(1)
  if (!row) unauthorized()
}
