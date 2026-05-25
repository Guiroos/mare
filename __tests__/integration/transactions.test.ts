import { describe, it, expect, beforeAll } from 'vitest'
import { eq, asc } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createCategoryGroup, createCategory, createAccount } from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let categoryId: string
let accountId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `transactions-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
  ;({ id: accountId } = await createAccount(db, userId))
})

async function insertInstallments(
  name: string,
  rows: Array<{ referenceMonth: string; installmentNumber: number }>
) {
  const totalInstallments = rows.length

  const [group] = await db
    .insert(schema.installmentGroups)
    .values({
      userId,
      accountId,
      categoryId,
      name,
      totalAmount: '1000.00',
      totalInstallments,
      startDate: rows[0].referenceMonth,
    })
    .returning({ id: schema.installmentGroups.id })

  await db.insert(schema.transactions).values(
    rows.map((r, i) => ({
      userId,
      accountId,
      categoryId,
      installmentGroupId: group.id,
      name: `${name} (${i + 1}/${totalInstallments})`,
      amount: (1000 / totalInstallments).toFixed(2),
      date: r.referenceMonth,
      referenceMonth: r.referenceMonth,
      installmentNumber: r.installmentNumber,
      totalInstallments,
    }))
  )

  return group.id
}

describe('compra parcelada', () => {
  it('cria N transações com nomes no padrão "<name> (i/N)"', async () => {
    const groupId = await insertInstallments('Notebook', [
      { referenceMonth: '2025-01-01', installmentNumber: 1 },
      { referenceMonth: '2025-02-01', installmentNumber: 2 },
      { referenceMonth: '2025-03-01', installmentNumber: 3 },
    ])

    const created = await db
      .select({
        name: schema.transactions.name,
        installmentNumber: schema.transactions.installmentNumber,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.installmentGroupId, groupId))
      .orderBy(asc(schema.transactions.installmentNumber))

    expect(created).toHaveLength(3)
    expect(created[0].name).toBe('Notebook (1/3)')
    expect(created[1].name).toBe('Notebook (2/3)')
    expect(created[2].name).toBe('Notebook (3/3)')
  })

  it('todas as parcelas têm installmentGroupId e totalInstallments corretos', async () => {
    const groupId = await insertInstallments('TV', [
      { referenceMonth: '2025-04-01', installmentNumber: 1 },
      { referenceMonth: '2025-05-01', installmentNumber: 2 },
    ])

    const created = await db
      .select({
        installmentGroupId: schema.transactions.installmentGroupId,
        totalInstallments: schema.transactions.totalInstallments,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.installmentGroupId, groupId))

    expect(created).toHaveLength(2)
    expect(created.every((t) => t.installmentGroupId === groupId)).toBe(true)
    expect(created.every((t) => t.totalInstallments === 2)).toBe(true)
  })

  it('parcelas com virada de ano têm referenceMonth correto', async () => {
    const groupId = await insertInstallments('Geladeira', [
      { referenceMonth: '2025-11-01', installmentNumber: 1 },
      { referenceMonth: '2025-12-01', installmentNumber: 2 },
      { referenceMonth: '2026-01-01', installmentNumber: 3 },
      { referenceMonth: '2026-02-01', installmentNumber: 4 },
    ])

    const created = await db
      .select({ referenceMonth: schema.transactions.referenceMonth })
      .from(schema.transactions)
      .where(eq(schema.transactions.installmentGroupId, groupId))
      .orderBy(asc(schema.transactions.installmentNumber))

    expect(created.map((t) => t.referenceMonth)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ])
  })
})
