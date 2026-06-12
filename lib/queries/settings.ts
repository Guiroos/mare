import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'

export async function getUserAutoRollover(userId: string): Promise<boolean> {
  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { autoRolloverFixedExpenses: true },
  })
  return row?.autoRolloverFixedExpenses ?? false
}
