'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { incomes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth/require-user'
import { createIncomeActionSchema, updateIncomeActionSchema } from '@/lib/validations/transactions'

export type CreateIncomeInput = {
  source: string
  amount: string
  referenceMonth: string
}

export async function createIncome(data: CreateIncomeInput) {
  const userId = await requireUserId()
  createIncomeActionSchema.parse(data)

  await db.insert(incomes).values({
    userId,
    source: data.source,
    amount: data.amount,
    referenceMonth: data.referenceMonth,
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}

export type UpdateIncomeInput = {
  id: string
  source: string
  amount: string
}

export async function updateIncome(data: UpdateIncomeInput) {
  const userId = await requireUserId()
  updateIncomeActionSchema.parse(data)

  await db
    .update(incomes)
    .set({ source: data.source, amount: data.amount })
    .where(and(eq(incomes.id, data.id), eq(incomes.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}

export async function deleteIncome(id: string) {
  const userId = await requireUserId()

  await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}
