import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('hex')
})

describe('generateDek / encryptDek / decryptDek', () => {
  it('gera DEK de 32 bytes', async () => {
    const { generateDek } = await import('@/lib/crypto/keys')
    expect(generateDek()).toHaveLength(32)
  })

  it('roundtrip: decryptDek(encryptDek(dek)) === dek', async () => {
    const { generateDek, encryptDek, decryptDek } = await import('@/lib/crypto/keys')
    const dek = generateDek()
    const encrypted = encryptDek(dek)
    expect(encrypted).toMatch(/^enc:/)
    expect(decryptDek(encrypted)).toEqual(dek)
  })

  it('throws se ENCRYPTION_MASTER_KEY não estiver definida', async () => {
    const { generateDek, encryptDek } = await import('@/lib/crypto/keys')
    const original = process.env.ENCRYPTION_MASTER_KEY
    delete process.env.ENCRYPTION_MASTER_KEY
    expect(() => encryptDek(generateDek())).toThrow('ENCRYPTION_MASTER_KEY')
    process.env.ENCRYPTION_MASTER_KEY = original
  })
})
