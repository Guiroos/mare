import { describe, it, expect, beforeAll, vi } from 'vitest'
import { eq, isNotNull } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createAccount,
  createTransaction,
  createCategoryGroup,
  createCategory,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))
vi.mock('@/lib/auth/ownership', () => ({ assertOwnsPaymentAccount: vi.fn() }))

neonTestingSetup()

let db: TestDb
let userId: string
let creditAccountId: string
let debitAccountId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `fatura-${Date.now()}`))
  ;({ id: creditAccountId } = await createAccount(db, userId, {
    name: 'Cartão Teste',
    type: 'credit',
    closingDay: 10,
  }))
  ;({ id: debitAccountId } = await createAccount(db, userId, {
    name: 'Conta Corrente',
    type: 'debit',
  }))
})

describe('userSettings — upsert via onConflictDoUpdate', () => {
  it('inserir duas vezes não cria duas rows', async () => {
    const accrualRow = { creditMode: 'accrual', faturaActiveFrom: null, updatedAt: new Date() }
    const faturaRow = {
      creditMode: 'fatura',
      faturaActiveFrom: '2025-01-01',
      updatedAt: new Date(),
    }

    const upsert = (values: typeof accrualRow | typeof faturaRow) =>
      db
        .insert(schema.userSettings)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: [schema.userSettings.userId], set: values })

    await upsert(accrualRow)
    await upsert(faturaRow)

    const rows = await db.query.userSettings.findMany({
      where: eq(schema.userSettings.userId, userId),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].creditMode).toBe('fatura')
  })

  it('atualiza creditMode corretamente na segunda chamada', async () => {
    const userId2 = (await createUser(db, `fatura-update-${Date.now()}`)).id

    await db
      .insert(schema.userSettings)
      .values({ userId: userId2, creditMode: 'accrual', updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.userSettings.userId],
        set: { creditMode: 'accrual', updatedAt: new Date() },
      })

    await db
      .insert(schema.userSettings)
      .values({
        userId: userId2,
        creditMode: 'fatura',
        faturaActiveFrom: '2025-01-01',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.userSettings.userId],
        set: { creditMode: 'fatura', faturaActiveFrom: '2025-01-01', updatedAt: new Date() },
      })

    const row = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId2),
    })
    expect(row?.creditMode).toBe('fatura')
    expect(row?.faturaActiveFrom).toBe('2025-01-01')
  })
})

describe('fatura payments — unique index transactions_fatura_unique_idx', () => {
  it('inserir segundo pagamento para mesmo account+cycle lança erro de constraint', async () => {
    const faturaCycleMonth = '2025-02-01'

    await createTransaction(db, userId, debitAccountId, {
      faturaAccountId: creditAccountId,
      faturaCycleMonth,
      categoryId: null,
      name: 'Pagamento fatura Cartão Teste',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    await expect(
      createTransaction(db, userId, debitAccountId, {
        faturaAccountId: creditAccountId,
        faturaCycleMonth,
        categoryId: null,
        name: 'Pagamento fatura duplicado',
        date: '2025-03-11',
        referenceMonth: '2025-03-01',
      })
    ).rejects.toThrow()
  })

  it('ciclos diferentes do mesmo cartão não conflitam', async () => {
    const userId2 = (await createUser(db, `fatura-cycles-${Date.now()}`)).id
    const { id: creditId } = await createAccount(db, userId2, { type: 'credit', closingDay: 10 })
    const { id: debitId } = await createAccount(db, userId2, { type: 'debit' })

    await createTransaction(db, userId2, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-01-01',
      categoryId: null,
      name: 'Pagamento jan',
      date: '2025-02-10',
      referenceMonth: '2025-02-01',
    })

    await expect(
      createTransaction(db, userId2, debitId, {
        faturaAccountId: creditId,
        faturaCycleMonth: '2025-02-01',
        categoryId: null,
        name: 'Pagamento fev',
        date: '2025-03-10',
        referenceMonth: '2025-03-01',
      })
    ).resolves.toBeDefined()
  })
})

describe('guard de pagamentos fatura — verificação por query (não constraint)', () => {
  it('existência de transação com faturaAccountId é a condição que bloqueia troca de regime', async () => {
    const userId3 = (await createUser(db, `fatura-guard-${Date.now()}`)).id
    const { id: creditId } = await createAccount(db, userId3, { type: 'credit', closingDay: 10 })
    const { id: debitId } = await createAccount(db, userId3, { type: 'debit' })

    const hasFaturaPaymentsBefore = await db.query.transactions.findFirst({
      where: (t, { and, eq, isNotNull }) =>
        and(eq(t.userId, userId3), isNotNull(t.faturaAccountId)),
      columns: { id: true },
    })
    expect(hasFaturaPaymentsBefore).toBeUndefined()

    await createTransaction(db, userId3, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-01-01',
      categoryId: null,
      name: 'Pagamento fatura',
      date: '2025-02-10',
      referenceMonth: '2025-02-01',
    })

    const hasFaturaPaymentsAfter = await db.query.transactions.findFirst({
      where: (t, { and, eq }) => and(eq(t.userId, userId3), isNotNull(t.faturaAccountId)),
      columns: { id: true },
    })
    // guard da action dispara baseado nessa query — não é constraint do banco
    expect(hasFaturaPaymentsAfter).toBeDefined()
  })
})

describe('createFaturaPayment — retorno tipado (ActionResult) em vez de throw', () => {
  it('devolve ok:false com code duplicate_payment ao tentar pagar o mesmo ciclo duas vezes', async () => {
    const { id: userId4 } = await createUser(db, `fatura-actions-dup-${Date.now()}`)
    const { id: creditId } = await createAccount(db, userId4, {
      name: 'Cartão Ação',
      type: 'credit',
      closingDay: 10,
    })
    const { id: debitId } = await createAccount(db, userId4, {
      name: 'Conta Ação',
      type: 'debit',
    })
    const group = await createCategoryGroup(db, userId4)
    const { id: categoryId } = await createCategory(db, userId4, group.id)

    await db.insert(schema.userSettings).values({
      userId: userId4,
      creditMode: 'fatura',
      faturaActiveFrom: '2025-01-01',
      updatedAt: new Date(),
    })

    // ciclo 2025-03: closingDay=10 => start=2025-02-10, end=2025-03-09
    await createTransaction(db, userId4, creditId, {
      categoryId,
      amount: '150.00',
      date: '2025-02-15',
      referenceMonth: '2025-02-01',
    })

    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockResolvedValue(userId4)
    const { assertOwnsPaymentAccount } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPaymentAccount).mockResolvedValue(undefined)

    const { createFaturaPayment } = await import('@/lib/actions/fatura')

    const payload = {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-03-01',
      sourceAccountId: debitId,
      amount: '150.00',
      date: '2025-03-10',
    }

    const first = await createFaturaPayment(payload)
    expect(first).toEqual({ ok: true, data: undefined })

    const second = await createFaturaPayment(payload)
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.code).toBe('duplicate_payment')
      expect(second.message).toBe('Já existe um pagamento registrado para este ciclo')
    }
  })

  it('devolve ok:false com code stale_total quando o valor enviado não bate com o total do ciclo', async () => {
    const { id: userId5 } = await createUser(db, `fatura-actions-stale-${Date.now()}`)
    const { id: creditId } = await createAccount(db, userId5, {
      name: 'Cartão Ação 2',
      type: 'credit',
      closingDay: 10,
    })
    const { id: debitId } = await createAccount(db, userId5, {
      name: 'Conta Ação 2',
      type: 'debit',
    })
    const group = await createCategoryGroup(db, userId5)
    const { id: categoryId } = await createCategory(db, userId5, group.id)

    await db.insert(schema.userSettings).values({
      userId: userId5,
      creditMode: 'fatura',
      faturaActiveFrom: '2025-01-01',
      updatedAt: new Date(),
    })

    // ciclo 2025-04: closingDay=10 => start=2025-03-10, end=2025-04-09
    await createTransaction(db, userId5, creditId, {
      categoryId,
      amount: '200.00',
      date: '2025-03-20',
      referenceMonth: '2025-03-01',
    })

    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockResolvedValue(userId5)
    const { assertOwnsPaymentAccount } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPaymentAccount).mockResolvedValue(undefined)

    const { createFaturaPayment } = await import('@/lib/actions/fatura')

    const result = await createFaturaPayment({
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-04-01',
      sourceAccountId: debitId,
      amount: '999.00',
      date: '2025-04-10',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('stale_total')
      expect(result.message).toBe(
        'O valor da fatura mudou. Feche e reabra o dialog para ver o valor atualizado.'
      )
    }
  })
})

describe('updateCreditMode — retorno tipado (ActionResult) em vez de throw', () => {
  it('devolve ok:false com code no_eligible_credit_account quando não há cartão elegível', async () => {
    const { id: userId6 } = await createUser(db, `fatura-mode-noaccount-${Date.now()}`)

    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockResolvedValue(userId6)

    const { updateCreditMode } = await import('@/lib/actions/fatura')

    const result = await updateCreditMode({ creditMode: 'fatura', faturaActiveFrom: '2025-05' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('no_eligible_credit_account')
      expect(result.message).toContain('Nenhum cartão de crédito')
    }
  })

  it('devolve ok:false com code fatura_payments_exist quando há pagamento de fatura registrado', async () => {
    const { id: userId7 } = await createUser(db, `fatura-mode-haspayments-${Date.now()}`)
    const { id: creditId7 } = await createAccount(db, userId7, {
      name: 'Cartão Ação 3',
      type: 'credit',
      closingDay: 10,
    })
    const { id: debitId7 } = await createAccount(db, userId7, {
      name: 'Conta Ação 3',
      type: 'debit',
    })

    await createTransaction(db, userId7, debitId7, {
      faturaAccountId: creditId7,
      faturaCycleMonth: '2025-05-01',
      categoryId: null,
      name: 'Pagamento fatura existente',
      date: '2025-06-10',
      referenceMonth: '2025-06-01',
    })

    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockResolvedValue(userId7)

    const { updateCreditMode } = await import('@/lib/actions/fatura')

    const result = await updateCreditMode({ creditMode: 'accrual' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('fatura_payments_exist')
      expect(result.message).toContain('pagamentos de fatura registrados')
    }
  })
})
