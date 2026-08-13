import { createHash, randomBytes } from 'crypto'

/** Generates a public statement link token: 32 bytes as base64url (43 chars, URL-safe). */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Hashes a share token for lookup. Hash, not encryption: AES-GCM is non-deterministic (random IV). */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
