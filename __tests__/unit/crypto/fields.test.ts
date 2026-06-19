import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

// Setar env antes de importar o módulo
beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('hex')
})

describe('encryptField / decryptField', () => {
  it('roundtrip: decrypt(encrypt(value)) === value', async () => {
    const { encryptField, decryptField } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    const value = 'R$ 1.234,56'
    const ciphertext = encryptField(value, dek)
    expect(ciphertext).toMatch(/^enc:/)
    expect(decryptField(ciphertext, dek)).toBe(value)
  })

  it('ciphertexts do mesmo valor são diferentes (IV aleatório)', async () => {
    const { encryptField } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    const c1 = encryptField('1234.56', dek)
    const c2 = encryptField('1234.56', dek)
    expect(c1).not.toBe(c2)
  })

  it('decryptField retorna plaintext como-está se sem prefixo enc: (compatibilidade)', async () => {
    const { decryptField } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    expect(decryptField('1234.56', dek)).toBe('1234.56')
  })

  it('decryptOptional retorna null para null', async () => {
    const { decryptOptional } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    expect(decryptOptional(null, dek)).toBeNull()
  })

  it('encryptOptional retorna null para null', async () => {
    const { encryptOptional } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    expect(encryptOptional(null, dek)).toBeNull()
  })

  it('throws ao decifrar com DEK errado', async () => {
    const { encryptField, decryptField } = await import('@/lib/crypto/fields')
    const dek1 = randomBytes(32)
    const dek2 = randomBytes(32)
    const ciphertext = encryptField('valor', dek1)
    expect(() => decryptField(ciphertext, dek2)).toThrow()
  })
})
