import { describe, it, expect, beforeAll, vi } from 'vitest'
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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))

neonTestingSetup()

let db: TestDb
let userId: string
let categoryId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `payment-accounts-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
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

describe('updatePaymentAccount — guard contra corromper regime de fatura (issue #115)', () => {
  it('recusa mudar type de credit para debit quando há pagamento de fatura vinculado à conta', async () => {
    const { id: creditId } = await createAccount(db, userId, {
      name: 'Cartão Com Fatura',
      type: 'credit',
      closingDay: 10,
    })
    const { id: debitId } = await createAccount(db, userId, { name: 'Conta Débito Guard' })
    await createTransaction(db, userId, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-02-01',
      categoryId: null,
      name: 'Pagamento fatura',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    const { updatePaymentAccount } = await import('@/lib/actions/categories')
    const result = await updatePaymentAccount(creditId, {
      name: 'Cartão Com Fatura',
      type: 'debit',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('fatura_payments_exist')
    }

    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, creditId),
    })
    expect(found?.type).toBe('credit')
    expect(found?.closingDay).toBe(10)
  })

  it('recusa mudar closingDay mantendo type credit quando há pagamento de fatura vinculado', async () => {
    const { id: creditId } = await createAccount(db, userId, {
      name: 'Cartão Fechamento Guard',
      type: 'credit',
      closingDay: 10,
    })
    const { id: debitId } = await createAccount(db, userId, { name: 'Conta Débito Guard 2' })
    await createTransaction(db, userId, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-02-01',
      categoryId: null,
      name: 'Pagamento fatura',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    const { updatePaymentAccount } = await import('@/lib/actions/categories')
    const result = await updatePaymentAccount(creditId, {
      name: 'Cartão Fechamento Guard',
      type: 'credit',
      closingDay: 20,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('fatura_payments_exist')
    }

    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, creditId),
    })
    expect(found?.closingDay).toBe(10)
  })

  it('permite renomear a conta sem mexer em type/closingDay mesmo com pagamento de fatura vinculado', async () => {
    const { id: creditId } = await createAccount(db, userId, {
      name: 'Cartão Renomear Guard',
      type: 'credit',
      closingDay: 10,
    })
    const { id: debitId } = await createAccount(db, userId, { name: 'Conta Débito Guard 3' })
    await createTransaction(db, userId, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-02-01',
      categoryId: null,
      name: 'Pagamento fatura',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    const { updatePaymentAccount } = await import('@/lib/actions/categories')
    const result = await updatePaymentAccount(creditId, {
      name: 'Nubank Roxinho',
      type: 'credit',
      closingDay: 10,
    })

    expect(result.ok).toBe(true)
    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, creditId),
    })
    expect(found?.type).toBe('credit')
    expect(found?.closingDay).toBe(10)
  })

  it('permite mudar type quando não há nenhum pagamento de fatura vinculado à conta', async () => {
    const { id: creditId } = await createAccount(db, userId, {
      name: 'Cartão Sem Fatura Guard',
      type: 'credit',
      closingDay: 10,
    })

    const { updatePaymentAccount } = await import('@/lib/actions/categories')
    const result = await updatePaymentAccount(creditId, {
      name: 'Cartão Sem Fatura Guard',
      type: 'debit',
    })

    expect(result.ok).toBe(true)
    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, creditId),
    })
    expect(found?.type).toBe('debit')
  })

  it('permite reconfigurar como crédito uma conta já corrompida (type=debit) que ainda tem pagamento de fatura', async () => {
    const { id: brokenId } = await createAccount(db, userId, {
      name: 'Cartão Corrompido',
      type: 'debit',
    })
    const { id: debitId } = await createAccount(db, userId, { name: 'Conta Débito Guard 4' })
    await createTransaction(db, userId, debitId, {
      faturaAccountId: brokenId,
      faturaCycleMonth: '2025-02-01',
      categoryId: null,
      name: 'Pagamento fatura',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    const { updatePaymentAccount } = await import('@/lib/actions/categories')
    const result = await updatePaymentAccount(brokenId, {
      name: 'Cartão Corrompido',
      type: 'credit',
      closingDay: 10,
    })

    expect(result.ok).toBe(true)
    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, brokenId),
    })
    expect(found?.type).toBe('credit')
    expect(found?.closingDay).toBe(10)
  })

  it('recusa recuperar uma conta corrompida com closingDay incompatível com pagamento já registrado', async () => {
    const { id: brokenId } = await createAccount(db, userId, {
      name: 'Cartão Corrompido Incompatível',
      type: 'debit',
    })
    const { id: debitId } = await createAccount(db, userId, { name: 'Conta Débito Guard 5' })
    // Pagamento do ciclo 2025-03: com closingDay=25, o ciclo recalculado vai até 2025-03-24 —
    // data do pagamento (2025-03-05) cairia dentro do próprio ciclo, não depois dele.
    await createTransaction(db, userId, debitId, {
      faturaAccountId: brokenId,
      faturaCycleMonth: '2025-03-01',
      categoryId: null,
      name: 'Pagamento fatura',
      date: '2025-03-05',
      referenceMonth: '2025-03-01',
    })

    const { updatePaymentAccount } = await import('@/lib/actions/categories')
    const result = await updatePaymentAccount(brokenId, {
      name: 'Cartão Corrompido Incompatível',
      type: 'credit',
      closingDay: 25,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('fatura_payments_incompatible')
    }

    const found = await db.query.paymentAccounts.findFirst({
      where: eq(schema.paymentAccounts.id, brokenId),
    })
    expect(found?.type).toBe('debit')
  })
})
