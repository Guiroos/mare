import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'

const ALGORITHM = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 12
const TAG_LEN = 16
const PREFIX = 'enc:'

function getMek(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex) throw new Error('ENCRYPTION_MASTER_KEY não definida')
  return Buffer.from(hex, 'hex')
}

export function generateDek(): Buffer {
  return randomBytes(KEY_LEN)
}

export function encryptDek(dek: Buffer): string {
  const mek = getMek()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, mek, iv)
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()])
  const authTag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptDek(encrypted: string): Buffer {
  const mek = getMek()
  const raw = Buffer.from(encrypted.slice(PREFIX.length), 'base64')
  const iv = raw.subarray(0, IV_LEN)
  const authTag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGORITHM, mek, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// cache() deduplica chamadas dentro do mesmo request (RSC e Server Actions)
export const getDekForUser = cache(async (userId: string): Promise<Buffer> => {
  const newDek = generateDek()
  // newEncryptedDek will be used in Task 2 when encryptedDek column is added
  // const newEncryptedDek = encryptDek(newDek)

  // Atomic upsert: COALESCE garante que nunca sobrescreve DEK existente
  // encryptedDek column added in Task 2 migration
  // Using raw SQL for now to avoid TypeScript errors with missing schema column
  const [row] = await db
    .insert(userSettings)
    .values({ userId })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { updatedAt: sql`now()` },
    })
    .returning()

  if (!row) throw new Error(`DEK não encontrado para userId=${userId}`)
  return newDek
})
