import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createCharge } from './helpers/factories'
import { generateShareToken, hashShareToken } from '@/lib/utils/share-token'

neonTestingSetup()

let db: TestDb
let userId: string
let personA: string
let personB: string
let tokenA: string
let tokenB: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `shared-${Date.now()}`))
  ;({ id: personA } = await createPerson(db, userId, 'Pessoa A'))
  ;({ id: personB } = await createPerson(db, userId, 'Pessoa B'))

  await createCharge(db, userId, personA, { amount: '100.00', description: 'Jantar A' })
  await createCharge(db, userId, personB, { amount: '250.00', description: 'Uber B' })

  tokenA = generateShareToken()
  tokenB = generateShareToken()
  await db
    .update(schema.people)
    .set({ shareTokenHash: hashShareToken(tokenA) })
    .where(eq(schema.people.id, personA))
  await db
    .update(schema.people)
    .set({ shareTokenHash: hashShareToken(tokenB) })
    .where(eq(schema.people.id, personB))
})

describe('getSharedDebtStatement', () => {
  it('devolve as cobranças em aberto da pessoa dona do token, decriptadas', async () => {
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    const result = await getSharedDebtStatement(hashShareToken(tokenA))

    expect(result).not.toBeNull()
    expect(result!.personName).toBe('Pessoa A')
    expect(result!.charges).toHaveLength(1)
    expect(result!.charges[0].description).toBe('Jantar A')
    expect(result!.charges[0].amount).toBe(100)
  })

  it('não vaza as cobranças de outra pessoa do mesmo dono', async () => {
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    const result = await getSharedDebtStatement(hashShareToken(tokenA))

    const descriptions = result!.charges.map((c) => c.description)
    expect(descriptions).not.toContain('Uber B')
  })

  it('devolve null para hash inexistente', async () => {
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    expect(await getSharedDebtStatement(hashShareToken(generateShareToken()))).toBeNull()
  })

  it('devolve lista vazia — não null — quando a pessoa não tem cobrança em aberto', async () => {
    const { id: semDivida } = await createPerson(db, userId, 'Sem Dívida')
    const token = generateShareToken()
    await db
      .update(schema.people)
      .set({ shareTokenHash: hashShareToken(token) })
      .where(eq(schema.people.id, semDivida))

    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    const result = await getSharedDebtStatement(hashShareToken(token))

    expect(result).not.toBeNull()
    expect(result!.charges).toEqual([])
  })
})
