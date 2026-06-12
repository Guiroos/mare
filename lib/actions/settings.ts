'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/require-user'

export async function updateAutoRollover(enabled: boolean) {
  const userId = await requireUserId()

  await db
    .insert(userSettings)
    .values({ userId, autoRolloverFixedExpenses: enabled })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { autoRolloverFixedExpenses: enabled, updatedAt: new Date() },
    })

  revalidatePath('/configuracao-mes')
}
