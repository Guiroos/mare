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

describe('assertMekConfigured', () => {
  it('não lança quando ENCRYPTION_MASTER_KEY é válida', async () => {
    const { assertMekConfigured } = await import('@/lib/crypto/keys')
    expect(() => assertMekConfigured()).not.toThrow()
  })

  it('lança quando ENCRYPTION_MASTER_KEY está ausente', async () => {
    const { assertMekConfigured } = await import('@/lib/crypto/keys')
    const original = process.env.ENCRYPTION_MASTER_KEY
    delete process.env.ENCRYPTION_MASTER_KEY
    expect(() => assertMekConfigured()).toThrow('ENCRYPTION_MASTER_KEY')
    process.env.ENCRYPTION_MASTER_KEY = original
  })

  it('lança quando ENCRYPTION_MASTER_KEY não tem 64 hex chars', async () => {
    const { assertMekConfigured } = await import('@/lib/crypto/keys')
    const original = process.env.ENCRYPTION_MASTER_KEY
    process.env.ENCRYPTION_MASTER_KEY = 'zz'
    expect(() => assertMekConfigured()).toThrow('64 hex chars')
    process.env.ENCRYPTION_MASTER_KEY = original
  })

  it('não distingue MEK rotacionada de MEK certa — só verifica forma', async () => {
    // Caracteriza o comportamento que reset-account.ts:82-86 documenta: a sonda passa mesmo
    // quando a MEK trocou (bem-formada, mas não é a que cifrou a DEK), e é o decryptDek
    // posterior que descobre isso pelo auth tag do GCM. Este teste NÃO trava o contrato de
    // resetAccount — chamar assertMekConfigured() com uma DEK específica não quebraria nada
    // aqui, já que ele não passa argumento nenhum. Quem protege o call site (chamada sem
    // argumento, antes da Fase 1 de delete) é
    // __tests__/unit/reset-account-mek-guard.test.ts.
    const { generateDek, encryptDek, decryptDek, assertMekConfigured } =
      await import('@/lib/crypto/keys')
    const original = process.env.ENCRYPTION_MASTER_KEY

    process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('hex')
    const dekCifrada = encryptDek(generateDek())

    process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('hex') // rotação, bem-formada
    expect(() => assertMekConfigured()).not.toThrow()
    expect(() => decryptDek(dekCifrada)).toThrow()

    process.env.ENCRYPTION_MASTER_KEY = original
  })
})
