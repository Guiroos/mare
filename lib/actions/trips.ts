'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { trips } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsGoal } from '@/lib/auth/ownership'
import { upsertTripActionSchema } from '@/lib/validations/trips'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField } from '@/lib/crypto/fields'
import { getActiveTrips } from '@/lib/queries/trips'

// Lista leve para o TripPicker em componentes de cliente que não carregam
// getRegistrationFormData() inteiro (ex: IncomeEditButton, que edita entrada
// sem categoria/conta e evitaria o custo do loader completo de propósito).
export async function getTripOptions() {
  const userId = await requireUserId()
  return getActiveTrips(userId)
}

export type UpsertTripInput = {
  name: string
  startDate?: string | null
  endDate?: string | null
  goalId?: string | null
  existingId?: string
}

export async function upsertTrip(data: UpsertTripInput) {
  const userId = await requireUserId()
  upsertTripActionSchema.parse(data)

  if (data.goalId) {
    await assertOwnsGoal(userId, data.goalId)
  }

  const dek = await getDekForUser(userId)

  const values = {
    name: encryptField(data.name.trim(), dek),
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    goalId: data.goalId || null,
  }

  if (data.existingId) {
    await db
      .update(trips)
      .set(values)
      .where(and(eq(trips.id, data.existingId), eq(trips.userId, userId)))
  } else {
    await db.insert(trips).values({ userId, ...values })
  }

  revalidatePath('/viagens')
}

export async function deleteTrip(id: string) {
  const userId = await requireUserId()
  await db.delete(trips).where(and(eq(trips.id, id), eq(trips.userId, userId)))
  revalidatePath('/viagens')
}
