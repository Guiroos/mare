import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
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
  ;({ id: userId } = await createUser(db, `installments-delete-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
  ;({ id: accountId } = await createAccount(db, userId))
})

async function createInstallmentGroup(name: string, totalInstallments: number) {
  const [group] = await db
    .insert(schema.installmentGroups)
    .values({
      userId,
      accountId,
      categoryId,
      name,
      totalAmount: '600.00',
      totalInstallments,
      startDate: '2025-01-01',
    })
    .returning({ id: schema.installmentGroups.id })

  const txIds: string[] = []
  for (let i = 1; i <= totalInstallments; i++) {
    const [tx] = await db
      .insert(schema.transactions)
      .values({
        userId,
        accountId,
        categoryId,
        installmentGroupId: group.id,
        name: `${name} (${i}/${totalInstallments})`,
        amount: (600 / totalInstallments).toFixed(2),
        date: `2025-0${i}-01`,
        referenceMonth: `2025-0${i}-01`,
        installmentNumber: i,
        totalInstallments,
      })
      .returning({ id: schema.transactions.id })
    txIds.push(tx.id)
  }

  return { groupId: group.id, txIds }
}

describe('installmentGroups — onDelete: set null em transactions.installmentGroupId', () => {
  it('deletar installmentGroup seta installmentGroupId como null nas transações — não as deleta', async () => {
    const { groupId, txIds } = await createInstallmentGroup('Notebook', 3)

    await db.delete(schema.installmentGroups).where(eq(schema.installmentGroups.id, groupId))

    // Transações ainda existem
    const remaining = await db.query.transactions.findMany({
      where: (t, { inArray }) => inArray(t.id, txIds),
    })
    expect(remaining).toHaveLength(3)

    // installmentGroupId foi nulificado em todas
    expect(remaining.every((t) => t.installmentGroupId === null)).toBe(true)
  })

  it('transações órfãs após deleção do grupo não têm installmentNumber ou totalInstallments perdidos', async () => {
    const { groupId, txIds } = await createInstallmentGroup('TV', 2)

    await db.delete(schema.installmentGroups).where(eq(schema.installmentGroups.id, groupId))

    const [tx] = await db.query.transactions.findMany({
      where: (t, { inArray }) => inArray(t.id, txIds),
    })

    // Os campos de parcela permanecem — só o vínculo ao grupo é perdido
    expect(tx.installmentNumber).not.toBeNull()
    expect(tx.totalInstallments).not.toBeNull()
    expect(tx.installmentGroupId).toBeNull()
  })

  it('installmentGroup não existe mais após a deleção', async () => {
    const { groupId } = await createInstallmentGroup('Geladeira', 2)

    await db.delete(schema.installmentGroups).where(eq(schema.installmentGroups.id, groupId))

    const found = await db.query.installmentGroups.findFirst({
      where: eq(schema.installmentGroups.id, groupId),
    })
    expect(found).toBeUndefined()
  })
})
