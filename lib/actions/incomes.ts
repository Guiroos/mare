'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { incomes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth/require-user'
import { createIncomeActionSchema, updateIncomeActionSchema } from '@/lib/validations/transactions'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'

export type CreateIncomeInput = {
  source: string
  amount: string
  referenceMonth: string
}

export async function createIncome(data: CreateIncomeInput) {
  const userId = await requireUserId()
  const parsed = createIncomeActionSchema.parse(data)
  const dek = await getDekForUser(userId)

  await db.insert(incomes).values({
    userId,
    referenceMonth: parsed.referenceMonth,
    source: encryptField(parsed.source, dek),
    amount: encryptField(parsed.amount, dek),
    investmentReturnCapital: encryptOptional(null, dek),
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
  const parsed = updateIncomeActionSchema.parse(data)
  const dek = await getDekForUser(userId)

  await db
    .update(incomes)
    .set({
      source: encryptField(parsed.source, dek),
      amount: encryptField(parsed.amount, dek),
    })
    .where(and(eq(incomes.id, parsed.id), eq(incomes.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}

export async function deleteIncome(id: string) {
  const userId = await requireUserId()

  await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}
