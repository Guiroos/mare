import { describe, it, expect, beforeAll } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createCharge, createPayment } from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let personId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `debtors-${Date.now()}`))
  ;({ id: personId } = await createPerson(db, userId))
})

describe('pessoas', () => {
  it('cria pessoa com userId correto e archived=false por padrão', async () => {
    const [p] = await db.insert(schema.people).values({ userId, name: 'Maria Teste' }).returning()

    expect(p.userId).toBe(userId)
    expect(p.archived).toBe(false)
  })

  it('archivePerson — seta archived=true sem deletar a row', async () => {
    const person = await createPerson(db, userId, 'Carlos Arquivado')

    await db.update(schema.people).set({ archived: true }).where(eq(schema.people.id, person.id))

    const updated = await db.query.people.findFirst({ where: eq(schema.people.id, person.id) })
    expect(updated?.archived).toBe(true)
    expect(updated?.name).toBe('Carlos Arquivado')
  })

  it('deletePersonIfEmpty — impede deleção quando há lançamentos', async () => {
    const person = await createPerson(db, userId, 'Pedro Com Histórico')
    await createCharge(db, userId, person.id)

    // Replica a guarda da action: busca entries antes de deletar
    async function deleteIfEmpty(pid: string) {
      const existing = await db.query.debtorEntries.findFirst({
        where: and(eq(schema.debtorEntries.personId, pid), eq(schema.debtorEntries.userId, userId)),
        columns: { id: true },
      })
      if (existing) throw new Error('Não é possível excluir uma pessoa com lançamentos.')
      await db.delete(schema.people).where(eq(schema.people.id, pid))
    }

    await expect(deleteIfEmpty(person.id)).rejects.toThrow('Não é possível excluir')

    const stillExists = await db.query.people.findFirst({ where: eq(schema.people.id, person.id) })
    expect(stillExists).toBeDefined()
  })

  it('deletePersonIfEmpty — deleta quando não há lançamentos', async () => {
    const person = await createPerson(db, userId, 'Ana Vazia')

    await db.delete(schema.people).where(eq(schema.people.id, person.id))

    const deleted = await db.query.people.findFirst({ where: eq(schema.people.id, person.id) })
    expect(deleted).toBeUndefined()
  })
})

describe('cobranças', () => {
  it('cria cobrança com status open, type charge e settledByPaymentId nulo', async () => {
    const [entry] = await db
      .insert(schema.debtorEntries)
      .values({
        userId,
        personId,
        type: 'charge',
        status: 'open',
        amount: '250.00',
        description: 'Almoço',
        entryDate: '2025-02-15',
        referenceMonth: '2025-02-01',
      })
      .returning()

    expect(entry.type).toBe('charge')
    expect(entry.status).toBe('open')
    expect(entry.settledByPaymentId).toBeNull()
  })
})

describe('settleCharge', () => {
  it('cria payment e marca charge como settled atomicamente', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Jantar',
      amount: '300.00',
      entryDate: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    let paymentId!: string

    await db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(schema.debtorEntries)
        .values({
          userId,
          personId,
          type: 'payment',
          amount: '300.00',
          description: 'Jantar',
          entryDate: '2025-03-20',
          referenceMonth: '2025-03-01',
        })
        .returning({ id: schema.debtorEntries.id })
      paymentId = payment.id

      await tx
        .update(schema.debtorEntries)
        .set({ status: 'settled', settledByPaymentId: payment.id })
        .where(eq(schema.debtorEntries.id, charge.id))
    })

    const settled = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    expect(settled?.status).toBe('settled')
    expect(settled?.settledByPaymentId).toBe(paymentId)
  })
})

describe('deleteDebtEntry com payment vinculado', () => {
  it('reseta charges para open antes de deletar o payment', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Uber',
      amount: '150.00',
      entryDate: '2025-04-05',
      referenceMonth: '2025-04-01',
    })
    const payment = await createPayment(db, userId, personId, {
      description: 'Uber',
      amount: '150.00',
      entryDate: '2025-04-10',
      referenceMonth: '2025-04-01',
    })

    await db
      .update(schema.debtorEntries)
      .set({ status: 'settled', settledByPaymentId: payment.id })
      .where(eq(schema.debtorEntries.id, charge.id))

    await db.transaction(async (tx) => {
      await tx
        .update(schema.debtorEntries)
        .set({ status: 'open', settledByPaymentId: null })
        .where(eq(schema.debtorEntries.settledByPaymentId, payment.id))

      await tx.delete(schema.debtorEntries).where(eq(schema.debtorEntries.id, payment.id))
    })

    const reopened = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    expect(reopened?.status).toBe('open')
    expect(reopened?.settledByPaymentId).toBeNull()
  })

  it('ON DELETE SET NULL não reseta status — UPDATE explícito é obrigatório', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Lanche',
      amount: '80.00',
      entryDate: '2025-05-01',
      referenceMonth: '2025-05-01',
    })
    const payment = await createPayment(db, userId, personId, {
      description: 'Lanche',
      amount: '80.00',
      entryDate: '2025-05-05',
      referenceMonth: '2025-05-01',
    })

    await db
      .update(schema.debtorEntries)
      .set({ status: 'settled', settledByPaymentId: payment.id })
      .where(eq(schema.debtorEntries.id, charge.id))

    // Deleta sem o UPDATE explícito de status (como SE a action não tivesse o guard)
    await db.delete(schema.debtorEntries).where(eq(schema.debtorEntries.id, payment.id))

    const afterDelete = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    // FK SET NULL limpou settledByPaymentId, mas status permanece 'settled' — bug latente
    expect(afterDelete?.settledByPaymentId).toBeNull()
    expect(afterDelete?.status).toBe('settled')
  })
})

describe('createDebtPayment com settleChargeIds', () => {
  it('vincula apenas as charges especificadas ao payment', async () => {
    const c1 = await createCharge(db, userId, personId, {
      description: 'Charge A',
      amount: '50.00',
      entryDate: '2025-06-01',
      referenceMonth: '2025-06-01',
    })
    const c2 = await createCharge(db, userId, personId, {
      description: 'Charge B',
      amount: '70.00',
      entryDate: '2025-06-02',
      referenceMonth: '2025-06-01',
    })
    // Charge de outra pessoa — não deve ser afetada
    const otherPerson = await createPerson(db, userId, 'Outra Pessoa')
    const cOther = await createCharge(db, userId, otherPerson.id, {
      description: 'Charge alheia',
      entryDate: '2025-06-01',
      referenceMonth: '2025-06-01',
    })

    const settleChargeIds = [c1.id, c2.id]
    const payment = await createPayment(db, userId, personId, {
      description: 'Pagamento agrupado',
      amount: '120.00',
      entryDate: '2025-06-10',
      referenceMonth: '2025-06-01',
    })

    await db
      .update(schema.debtorEntries)
      .set({ status: 'settled', settledByPaymentId: payment.id })
      .where(
        and(
          inArray(schema.debtorEntries.id, settleChargeIds),
          eq(schema.debtorEntries.userId, userId),
          eq(schema.debtorEntries.type, 'charge')
        )
      )

    const settled = await db.query.debtorEntries.findMany({
      where: eq(schema.debtorEntries.settledByPaymentId, payment.id),
    })

    expect(settled).toHaveLength(2)
    expect(settled.map((c) => c.id).sort()).toEqual(settleChargeIds.sort())

    // Charge alheia não foi afetada
    const untouched = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, cOther.id),
    })
    expect(untouched?.status).toBe('open')
    expect(untouched?.settledByPaymentId).toBeNull()
  })
})

describe('createDebtPayment com createIncome', () => {
  it('income e payment compartilham o mesmo incomeId', async () => {
    const [income] = await db
      .insert(schema.incomes)
      .values({
        userId,
        source: 'João Teste — Reembolso',
        amount: '200.00',
        referenceMonth: '2025-07-01',
      })
      .returning({ id: schema.incomes.id })

    const [payment] = await db
      .insert(schema.debtorEntries)
      .values({
        userId,
        personId,
        type: 'payment',
        amount: '200.00',
        description: 'Reembolso',
        entryDate: '2025-07-15',
        referenceMonth: '2025-07-01',
        incomeId: income.id,
      })
      .returning({ id: schema.debtorEntries.id, incomeId: schema.debtorEntries.incomeId })

    expect(payment.incomeId).toBe(income.id)
  })

  it('deletar income com alsoDeleteIncome remove o income vinculado', async () => {
    const [income] = await db
      .insert(schema.incomes)
      .values({
        userId,
        source: 'Link para deletar',
        amount: '50.00',
        referenceMonth: '2025-08-01',
      })
      .returning({ id: schema.incomes.id })

    const [payment] = await db
      .insert(schema.debtorEntries)
      .values({
        userId,
        personId,
        type: 'payment',
        amount: '50.00',
        description: 'Pagamento com income',
        entryDate: '2025-08-10',
        referenceMonth: '2025-08-01',
        incomeId: income.id,
      })
      .returning({ id: schema.debtorEntries.id, incomeId: schema.debtorEntries.incomeId })

    // Replica lógica de deleteDebtEntry com alsoDeleteIncome=true
    await db.transaction(async (tx) => {
      await tx.delete(schema.incomes).where(eq(schema.incomes.id, payment.incomeId!))
      await tx.delete(schema.debtorEntries).where(eq(schema.debtorEntries.id, payment.id))
    })

    const deletedIncome = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, income.id),
    })
    expect(deletedIncome).toBeUndefined()
  })
})
