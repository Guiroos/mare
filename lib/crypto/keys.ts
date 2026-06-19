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
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('ENCRYPTION_MASTER_KEY deve ter 64 hex chars (32 bytes)')
  return buf
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
  if (!encrypted.startsWith(PREFIX)) throw new Error('DEK inválido: falta prefixo enc:')
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
  const newEncryptedDek = encryptDek(newDek)

  // encryptedDek column added in Task 2 migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = (await db
    .insert(userSettings)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .values({ userId, encryptedDek: newEncryptedDek } as any)
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        // @ts-expect-error – encryptedDek not yet in schema
        encryptedDek: sql`COALESCE(user_settings.encrypted_dek, EXCLUDED.encrypted_dek)`,
      },
    })
    // @ts-expect-error – encryptedDek not yet in schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .returning({ encryptedDek: userSettings.encryptedDek })) as any

  if (!row?.encryptedDek) throw new Error(`DEK não encontrado para userId=${userId}`)
  return decryptDek(row.encryptedDek)
})
