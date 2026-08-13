import { describe, it, expect } from 'vitest'
import { generateShareToken, hashShareToken } from '@/lib/utils/share-token'
import { shareTokenSchema } from '@/lib/validations/utils'

describe('generateShareToken', () => {
  it('gera 43 caracteres do alfabeto base64url', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('não repete entre chamadas', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()))
    expect(tokens.size).toBe(50)
  })
})

describe('hashShareToken', () => {
  it('é determinístico para a mesma entrada', () => {
    const token = generateShareToken()
    expect(hashShareToken(token)).toBe(hashShareToken(token))
  })

  it('devolve 64 chars hex', () => {
    expect(hashShareToken('abc')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('difere para entradas diferentes', () => {
    expect(hashShareToken(generateShareToken())).not.toBe(hashShareToken(generateShareToken()))
  })
})

describe('shareTokenSchema', () => {
  it('aceita um token gerado', () => {
    expect(shareTokenSchema.safeParse(generateShareToken()).success).toBe(true)
  })

  it.each([
    ['vazio', ''],
    ['curto demais', 'abc'],
    ['com caractere fora do alfabeto', 'a'.repeat(42) + '+'],
    ['longo demais', 'a'.repeat(44)],
    ['com barra (base64 comum, não base64url)', 'a'.repeat(42) + '/'],
  ])('rejeita %s', (_label, input) => {
    expect(shareTokenSchema.safeParse(input).success).toBe(false)
  })
})
