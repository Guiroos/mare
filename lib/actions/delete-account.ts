'use server'

import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/require-user'

export type DeleteAccountResult = { ok: true } | { ok: false; error: string }

/**
 * Server Action é endpoint HTTP: o argumento é controlado por quem chama,
 * independente do que a assinatura TypeScript diz. Sem o parse, um payload com
 * `null` ou objeto faz `.trim()` lançar TypeError e vira 500 opaco, justamente
 * o que o retorno tipado existe para evitar.
 */
const confirmEmailSchema = z.string()

/**
 * A sessão é JWT (`lib/auth.ts`), não banco — apagar a linha de `sessions` não
 * invalida o cookie. O cliente chama `signOut()` depois, mas depender só dele
 * deixa a janela em que o usuário navega numa conta inexistente (outra aba,
 * fechamento do navegador, falha de rede no signOut) durar até o `maxAge` de
 * 24h. Limpar aqui fecha a janela; o `signOut()` do cliente vira redundância.
 */
const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token']

export async function deleteAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  const userId = await requireUserId()

  const parsed = confirmEmailSchema.safeParse(confirmEmail)
  if (!parsed.success) return { ok: false, error: 'E-mail de confirmação não confere.' }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return { ok: false, error: 'Conta não encontrada.' }

  const typed = parsed.data.trim().toLowerCase()
  if (typed.length === 0 || typed !== user.email.trim().toLowerCase()) {
    return { ok: false, error: 'E-mail de confirmação não confere.' }
  }

  await db.delete(users).where(eq(users.id, userId))

  const cookieStore = await cookies()
  for (const name of SESSION_COOKIES) cookieStore.delete(name)

  return { ok: true }
}
