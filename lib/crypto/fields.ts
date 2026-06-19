import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const PREFIX = 'enc:'

export function encryptField(plaintext: string, dek: Buffer): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, dek, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptField(value: string, dek: Buffer): string {
  if (!value.startsWith(PREFIX)) return value // compatibilidade: plaintext antigo
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64')
  const iv = raw.subarray(0, IV_LEN)
  const authTag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGORITHM, dek, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function encryptOptional(value: string | null | undefined, dek: Buffer): string | null {
  if (value == null) return null
  return encryptField(value, dek)
}

export function decryptOptional(value: string | null | undefined, dek: Buffer): string | null {
  if (value == null) return null
  return decryptField(value, dek)
}
