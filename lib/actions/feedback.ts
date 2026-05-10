'use server'

import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/require-user'

export async function submitFeedback(data: {
  category: 'melhoria' | 'implementacao' | 'outros'
  message: string
  page: string
}) {
  const userId = await requireUserId()

  await db.insert(feedback).values({
    userId,
    category: data.category,
    message: data.message,
    page: data.page,
  })
}
