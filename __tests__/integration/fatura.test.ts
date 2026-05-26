import { describe, it, expect, beforeAll } from 'vitest'
import { eq, isNotNull } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createAccount, createTransaction } from './helpers/factories'

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
