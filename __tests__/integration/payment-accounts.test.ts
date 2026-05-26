import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createAccount,
  createCategoryGroup,
  createCategory,
  createTransaction,
  createFixedExpense,
  createInstallmentGroup,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let categoryId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `payment-accounts-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
})

describe('paymentAccounts — onDelete: restrict em transactions', () => {
  it('deleta conta sem transações vinculadas sem erro', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Sem Tx' })

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).resolves.not.toThrow()

    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, account.id),
    })
    expect(found).toBeUndefined()
  })

  it('lança erro de FK ao tentar deletar conta com transação vinculada', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Com Tx' })
    await createTransaction(db, userId, account.id, { categoryId })

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).rejects.toThrow()

    // A conta ainda existe (FK impediu a deleção)
    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, account.id),
    })
    expect(found).toBeDefined()
  })
})

describe('paymentAccounts — onDelete: restrict em fixedExpenses', () => {
  it('deleta conta sem gastos fixos vinculados sem erro', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Sem GF' })

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).resolves.not.toThrow()

    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, account.id),
    })
    expect(found).toBeUndefined()
  })

  it('lança erro de FK ao tentar deletar conta com gasto fixo vinculado', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Com GF' })
    await createFixedExpense(db, userId, account.id, categoryId)

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).rejects.toThrow()

    // A conta ainda existe (FK impediu a deleção)
    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, account.id),
    })
    expect(found).toBeDefined()
  })

  it('lança erro mesmo com transação E gasto fixo vinculados — restrict em ambas as FKs', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Com Tx+GF' })
    await createTransaction(db, userId, account.id, { categoryId })
    await createFixedExpense(db, userId, account.id, categoryId)

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).rejects.toThrow()
  })
})

describe('paymentAccounts — onDelete: restrict em installmentGroups', () => {
  it('deleta conta sem installmentGroups vinculados sem erro', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Sem IG' })

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).resolves.not.toThrow()

    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, account.id),
    })
    expect(found).toBeUndefined()
  })

  it('lança erro de FK ao tentar deletar conta com installmentGroup vinculado', async () => {
    const account = await createAccount(db, userId, { name: 'Conta Com IG' })
    await createInstallmentGroup(db, userId, account.id, categoryId)

    await expect(
      db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.id, account.id))
    ).rejects.toThrow()

    // A conta ainda existe (FK impediu a deleção)
    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, account.id),
    })
    expect(found).toBeDefined()
  })
})
