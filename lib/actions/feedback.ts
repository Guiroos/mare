'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/require-user'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField } from '@/lib/crypto/fields'

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
  const dek = await getDekForUser(userId)

  await db.insert(feedback).values({
    userId,
    category: data.category,
    message: encryptField(data.message, dek),
    page: data.page,
  })
}
