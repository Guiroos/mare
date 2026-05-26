import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createCategoryGroup,
  createCategory,
  createAccount,
  createTransaction,
  createFixedExpense,
  createInstallmentGroup,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let accountId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `categories-${Date.now()}`))
  ;({ id: accountId } = await createAccount(db, userId))
})

describe('categories.categoryId — onDelete: restrict em transactions', () => {
  it('deleta categoria sem transações vinculadas sem erro', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)

    await expect(
      db.delete(schema.categories).where(eq(schema.categories.id, category.id))
    ).resolves.not.toThrow()

    const found = await db.query.categories.findFirst({
      where: eq(schema.categories.id, category.id),
    })
    expect(found).toBeUndefined()
  })

  it('lança erro de FK ao tentar deletar categoria com transação vinculada', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    await createTransaction(db, userId, accountId, { categoryId: category.id })

    await expect(
      db.delete(schema.categories).where(eq(schema.categories.id, category.id))
    ).rejects.toThrow()
  })

  it('lança erro de FK ao tentar deletar categoria com gasto fixo vinculado', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    await createFixedExpense(db, userId, accountId, category.id)

    await expect(
      db.delete(schema.categories).where(eq(schema.categories.id, category.id))
    ).rejects.toThrow()
  })
})

describe('categoryGroups — cascade para categories', () => {
  it('deletar grupo sem categorias com dependentes remove o grupo e as categorias', async () => {
    const group = await createCategoryGroup(db, userId)
    const cat1 = await createCategory(db, userId, group.id, { name: 'Cat A' })
    const cat2 = await createCategory(db, userId, group.id, { name: 'Cat B' })

    await db.delete(schema.categoryGroups).where(eq(schema.categoryGroups.id, group.id))

    const cats = await db.query.categories.findMany({
      where: (t, { inArray }) => inArray(t.id, [cat1.id, cat2.id]),
    })
    expect(cats).toHaveLength(0)
  })

  it('deletar grupo falha quando uma categoria tem transação vinculada (cascade bate no restrict)', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    await createTransaction(db, userId, accountId, { categoryId: category.id })

    // O cascade do grupo tenta deletar a categoria, mas a FK restrict em
    // transactions.categoryId impede — esse encadeamento é o gotcha real
    await expect(
      db.delete(schema.categoryGroups).where(eq(schema.categoryGroups.id, group.id))
    ).rejects.toThrow()

    // O grupo ainda existe (rollback da operação)
    const group_ = await db.query.categoryGroups.findFirst({
      where: eq(schema.categoryGroups.id, group.id),
    })
    expect(group_).toBeDefined()
  })

  it('deletar grupo falha quando uma categoria tem gasto fixo vinculado', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    await createFixedExpense(db, userId, accountId, category.id)

    await expect(
      db.delete(schema.categoryGroups).where(eq(schema.categoryGroups.id, group.id))
    ).rejects.toThrow()
  })
})

describe('categories.categoryId — onDelete: restrict em installmentGroups', () => {
  it('lança erro de FK ao tentar deletar categoria com installmentGroup vinculado', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    await createInstallmentGroup(db, userId, accountId, category.id)

    await expect(
      db.delete(schema.categories).where(eq(schema.categories.id, category.id))
    ).rejects.toThrow()
  })

  it('deletar grupo falha quando categoria tem installmentGroup vinculado (cascade bate no restrict)', async () => {
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    await createInstallmentGroup(db, userId, accountId, category.id)

    // O cascade do grupo tenta deletar a categoria, mas a FK restrict em
    // installmentGroups.categoryId impede — encadeamento análogo ao de transactions
    await expect(
      db.delete(schema.categoryGroups).where(eq(schema.categoryGroups.id, group.id))
    ).rejects.toThrow()

    const group_ = await db.query.categoryGroups.findFirst({
      where: eq(schema.categoryGroups.id, group.id),
    })
    expect(group_).toBeDefined()
  })
})
