import { auth } from '@/lib/auth'

export async function requireUserId(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('Não autorizado')
  return userId
}
