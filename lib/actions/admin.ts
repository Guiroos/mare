'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

const VALID_STATUSES = ['new', 'read', 'done', 'dismissed']

export async function updateFeedbackStatus(id: string, status: string) {
  const session = await auth()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!session?.user?.email || !adminEmail || session.user.email !== adminEmail) {
    throw new Error('Unauthorized')
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid status')
  }
  await db.update(feedback).set({ status }).where(eq(feedback.id, id))
  revalidatePath('/admin')
}
