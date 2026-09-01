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

    expect(todos.find((f) => f.id === orfa!.id)?.message).toBe(
      '[mensagem ilegível — chave rotacionada]'
    )
  })
})
