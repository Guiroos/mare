'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/require-user'

const feedbackSchema = z.object({
  category: z.enum(['melhoria', 'implementacao', 'outros']),
  message: z.string().min(1).max(5000),
  page: z.string().max(200),
})

export async function submitFeedback(data: {
  category: 'melhoria' | 'implementacao' | 'outros'
  message: string
  page: string
}) {
  const userId = await requireUserId()
  feedbackSchema.parse(data)

  await db.insert(feedback).values({
    userId,
    category: data.category,
    message: data.message,
    page: data.page,
  })
}
