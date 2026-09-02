import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser } from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `admin-feedback-${Date.now()}`))
})

describe('getAllFeedbacks', () => {
  it('não derruba a lista quando uma linha está órfã (cifrada com outra DEK)', async () => {
    const { encryptField } = await import('@/lib/crypto/fields')
    const { getAllFeedbacks } = await import('@/lib/queries/admin')

    // Simula uma linha cifrada com uma DEK que não é a do usuário — mesmo estado de uma
    // linha órfã de um reset de conta cuja DEK antiga foi destruída.
    const [orfa] = await db
      .insert(schema.feedback)
      .values({
        userId,
        category: 'outros',
        page: '/dashboard',
        message: encryptField('cifrado com DEK destruída', randomBytes(32)),
      })
      .returning({ id: schema.feedback.id })

    const todos = await getAllFeedbacks()

    expect(todos.find((f) => f.id === orfa!.id)?.message).toBe('[mensagem ilegível]')
  })

  it('não derruba a lista quando a DEK do usuário está ilegível', async () => {
    const { getAllFeedbacks } = await import('@/lib/queries/admin')

    const [outro] = await db
      .insert(schema.users)
      .values({ email: `dek-ilegivel-${Date.now()}@t.com` })
      .returning({ id: schema.users.id })

    // 'enc:' + bytes aleatórios: passa o guard de prefixo e falha no auth tag do GCM,
    // que é o estado de uma DEK cifrada com uma MEK que não é mais a do ambiente.
    await db.insert(schema.userSettings).values({
      userId: outro!.id,
      encryptedDek: 'enc:' + randomBytes(60).toString('base64'),
      creditMode: 'accrual',
      faturaActiveFrom: null,
    })
    const [linha] = await db
      .insert(schema.feedback)
      .values({ userId: outro!.id, category: 'outros', page: '/x', message: 'qualquer' })
      .returning({ id: schema.feedback.id })

    const todos = await getAllFeedbacks()

    expect(todos.find((f) => f.id === linha!.id)?.message).toBe('[mensagem ilegível]')
  })
})
