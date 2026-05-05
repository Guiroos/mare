'use server'

import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { auth } from '@/lib/auth'

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as { id?: string })?.id
  if (!userId) throw new Error('Não autorizado')
  return userId
}

export async function submitFeedback(data: {
  category: 'melhoria' | 'implementacao' | 'outros'
  message: string
  page: string
}) {
  const session = await auth()
  const userId = requireUserId(session)

  await db.insert(feedback).values({
    userId,
    category: data.category,
    message: data.message,
    page: data.page,
  })
}
