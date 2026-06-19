'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { goals, goalContributions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsInvestmentType, assertOwnsGoal } from '@/lib/auth/ownership'
import {
  upsertGoalActionSchema,
  addContributionActionSchema,
  updateContributionActionSchema,
} from '@/lib/validations/goals'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField } from '@/lib/crypto/fields'

export type UpsertGoalInput = {
  name: string
  targetAmount: string
  targetDate?: string | null
  investmentTypeId?: string | null
  existingId?: string
}

export async function upsertGoal(data: UpsertGoalInput) {
  const userId = await requireUserId()
  upsertGoalActionSchema.parse(data)

  if (data.investmentTypeId) {
    await assertOwnsInvestmentType(userId, data.investmentTypeId)
  }

  const dek = await getDekForUser(userId)

  const values = {
    name: encryptField(data.name.trim(), dek),
    targetAmount: encryptField(data.targetAmount, dek),
    targetDate: data.targetDate || null,
    investmentTypeId: data.investmentTypeId || null,
  }

  if (data.existingId) {
    await db
      .update(goals)
      .set(values)
      .where(and(eq(goals.id, data.existingId), eq(goals.userId, userId)))
  } else {
    await db.insert(goals).values({ userId, ...values })
  }

  revalidatePath('/metas')
}

export async function deleteGoal(id: string) {
  const userId = await requireUserId()
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)))
  revalidatePath('/metas')
}

export type AddContributionInput = {
  goalId: string
  amount: string
  referenceMonth: string
}

export async function addGoalContribution(data: AddContributionInput) {
  const userId = await requireUserId()
  addContributionActionSchema.parse(data)

  await assertOwnsGoal(userId, data.goalId)

  const dek = await getDekForUser(userId)

  await db.insert(goalContributions).values({
    goalId: data.goalId,
    userId,
    amount: encryptField(data.amount, dek),
    referenceMonth: data.referenceMonth,
    source: 'manual',
  })
  revalidatePath('/metas')
}

export type UpdateContributionInput = {
  id: string
  amount: string
  referenceMonth: string
}

export async function updateGoalContribution(data: UpdateContributionInput) {
  const userId = await requireUserId()
  updateContributionActionSchema.parse(data)

  const dek = await getDekForUser(userId)

  await db
    .update(goalContributions)
    .set({ amount: encryptField(data.amount, dek), referenceMonth: data.referenceMonth })
    .where(and(eq(goalContributions.id, data.id), eq(goalContributions.userId, userId)))

  revalidatePath('/metas')
}

export async function deleteGoalContribution(id: string) {
  const userId = await requireUserId()
  await db
    .delete(goalContributions)
    .where(and(eq(goalContributions.id, id), eq(goalContributions.userId, userId)))
  revalidatePath('/metas')
}
