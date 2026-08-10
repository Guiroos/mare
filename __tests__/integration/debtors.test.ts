import { describe, it, expect, beforeAll, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createPerson,
  createCharge,
  createPayment,
  createAdjustment,
  createAccount,
  createCategoryGroup,
  createCategory,
  createTransaction,
  createIncome,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))
vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsPerson: vi.fn(),
  assertOwnsDebtEntry: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let personId: string
let accountId: string
let categoryId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `debtors-${Date.now()}`))
  ;({ id: personId } = await createPerson(db, userId))
  ;({ id: accountId } = await createAccount(db, userId))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
  const { assertOwnsDebtEntry } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsDebtEntry).mockResolvedValue(undefined)
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

describe('debtorEntries.sourceTransactionId — ON DELETE SET NULL', () => {
  it('deletar transação vinculada nulifica sourceTransactionId sem deletar a entry', async () => {
    const tx = await createTransaction(db, userId, accountId, { categoryId })
    const charge = await createCharge(db, userId, personId, {
      description: 'Origem em transação',
      amount: '60.00',
      entryDate: '2025-09-01',
      referenceMonth: '2025-09-01',
      sourceTransactionId: tx.id,
    })

    await db.delete(schema.transactions).where(eq(schema.transactions.id, tx.id))

    const entry = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    expect(entry).toBeDefined()
    expect(entry?.sourceTransactionId).toBeNull()
  })
})

describe('debtorEntries.incomeId — ON DELETE SET NULL', () => {
  it('deletar income vinculado nulifica incomeId sem deletar a entry', async () => {
    const income = await createIncome(db, userId, { referenceMonth: '2025-10-01' })
    const payment = await createPayment(db, userId, personId, {
      description: 'Pagamento com income vinculado',
      amount: '90.00',
      entryDate: '2025-10-05',
      referenceMonth: '2025-10-01',
      incomeId: income.id,
    })

    await db.delete(schema.incomes).where(eq(schema.incomes.id, income.id))

    const entry = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, payment.id),
    })

    expect(entry).toBeDefined()
    expect(entry?.incomeId).toBeNull()
  })
})

describe('getPersonDebtDetails — ajustes no saldo', () => {
  it('ajuste negativo zera o saldo e NÃO conta como cobrança', async () => {
    const person = await createPerson(db, userId, 'GF Ajuste Negativo')
    await createCharge(db, userId, person.id, { amount: '500.00', description: 'Dívidas' })
    await createPayment(db, userId, person.id, { amount: '400.00', description: 'Pgto 400' })
    await createAdjustment(db, userId, person.id, { amount: '-100.00', description: 'Abatimento' })

    const { getPersonDebtDetails } = await import('@/lib/queries/debtors')
    const detail = await getPersonDebtDetails(userId, person.id)
    if (!detail) throw new Error('detail não encontrado')

    expect(detail.summary.balance).toBe(0)
    expect(detail.summary.chargeCount).toBe(1)
    expect(detail.summary.totalCharged).toBe(500)
    expect(detail.summary.paymentCount).toBe(1)
    expect(detail.summary.totalPaid).toBe(400)
  })

  it('ajuste positivo aumenta o saldo sem virar cobrança', async () => {
    const person = await createPerson(db, userId, 'GF Ajuste Positivo')
    await createCharge(db, userId, person.id, { amount: '500.00', description: 'Dívida' })
    await createAdjustment(db, userId, person.id, { amount: '50.00', description: 'Correção' })

    const { getPersonDebtDetails } = await import('@/lib/queries/debtors')
    const detail = await getPersonDebtDetails(userId, person.id)
    if (!detail) throw new Error('detail não encontrado')

    expect(detail.summary.balance).toBe(550)
    expect(detail.summary.chargeCount).toBe(1)
    expect(detail.summary.totalCharged).toBe(500)
  })
})

describe('updateDebtEntry', () => {
  it('atualiza valor, descrição, data e recalcula referenceMonth ao mudar de mês', async () => {
    const charge = await createCharge(db, userId, personId, {
      amount: '100.00',
      description: 'Almoço',
      entryDate: '2025-01-10',
      referenceMonth: '2025-01-01',
    })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await updateDebtEntry({
      id: charge.id,
      amount: '100.05',
      description: 'Almoço editado',
      entryDate: '2025-02-15',
      notes: 'movido um mês',
    })

    const row = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })
    expect(row?.entryDate).toBe('2025-02-15')
    expect(row?.referenceMonth).toBe('2025-02-01')

    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField, decryptOptional } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)
    expect(decryptField(row!.amount, dek)).toBe('100.05')
    expect(decryptField(row!.description, dek)).toBe('Almoço editado')
    expect(decryptOptional(row!.notes, dek)).toBe('movido um mês')
  })

  it('edita cobrança já quitada — valor e observação', async () => {
    const charge = await createCharge(db, userId, personId, {
      amount: '80.00',
      description: 'Uber',
      status: 'settled',
    })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await updateDebtEntry({
      id: charge.id,
      amount: '80.10',
      description: 'Uber',
      entryDate: '2025-01-10',
      notes: 'faltavam 10 centavos',
    })

    const row = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })
    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField, decryptOptional } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)
    expect(decryptField(row!.amount, dek)).toBe('80.10')
    expect(decryptOptional(row!.notes, dek)).toBe('faltavam 10 centavos')
    expect(row?.status).toBe('settled')
  })

  it('preserva o sinal negativo de um ajuste via amountSign', async () => {
    const adjustment = await createAdjustment(db, userId, personId, { amount: '-100.00' })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await updateDebtEntry({
      id: adjustment.id,
      amount: '25.50',
      amountSign: 'negative',
      description: 'Abatimento corrigido',
      entryDate: '2025-01-20',
    })

    const row = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, adjustment.id),
    })
    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)
    expect(decryptField(row!.amount, dek)).toBe('-25.50')
  })

  it('inverte o sinal de um ajuste para positivo quando amountSign muda', async () => {
    const adjustment = await createAdjustment(db, userId, personId, { amount: '-40.00' })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await updateDebtEntry({
      id: adjustment.id,
      amount: '40.00',
      amountSign: 'positive',
      description: 'Virou acréscimo',
      entryDate: '2025-01-20',
    })

    const row = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, adjustment.id),
    })
    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)
    expect(decryptField(row!.amount, dek)).toBe('40.00')
  })

  it('ignora amountSign em cobrança — cobrança nunca fica negativa', async () => {
    const charge = await createCharge(db, userId, personId, { amount: '30.00' })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await updateDebtEntry({
      id: charge.id,
      amount: '30.00',
      amountSign: 'negative',
      description: 'Cobrança teste',
      entryDate: '2025-01-10',
    })

    const row = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })
    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)
    expect(decryptField(row!.amount, dek)).toBe('30.00')
  })

  it('sincroniza a entrada vinculada e não move o referenceMonth do pagamento', async () => {
    const person = await createPerson(db, userId, 'Sincronia Entrada')
    const income = await createIncome(db, userId, {
      source: 'Sincronia Entrada — Pgto',
      amount: '200.00',
      referenceMonth: '2025-03-01',
    })
    const payment = await createPayment(db, userId, person.id, {
      amount: '200.00',
      description: 'Pgto',
      entryDate: '2025-03-05',
      referenceMonth: '2025-03-01',
      incomeId: income.id,
    })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await updateDebtEntry({
      id: payment.id,
      amount: '199.90',
      description: 'Pgto corrigido',
      entryDate: '2025-04-02',
    })

    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)

    const entryRow = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, payment.id),
    })
    expect(entryRow?.entryDate).toBe('2025-04-02')
    // entryDate mudou de mês, mas o referenceMonth segue o da entrada vinculada
    expect(entryRow?.referenceMonth).toBe('2025-03-01')
    expect(decryptField(entryRow!.amount, dek)).toBe('199.90')

    const incomeRow = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, income.id),
    })
    expect(decryptField(incomeRow!.amount, dek)).toBe('199.90')
    expect(decryptField(incomeRow!.source, dek)).toBe('Sincronia Entrada — Pgto corrigido')
    expect(incomeRow?.referenceMonth).toBe('2025-03-01')
  })

  it('revalida /dashboard e /panorama quando há entrada vinculada', async () => {
    const person = await createPerson(db, userId, 'Revalida Entrada')
    const income = await createIncome(db, userId, { source: 'x', amount: '50.00' })
    const payment = await createPayment(db, userId, person.id, {
      amount: '50.00',
      incomeId: income.id,
    })

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    vi.mocked(revalidatePath).mockClear()
    await updateDebtEntry({
      id: payment.id,
      amount: '50.00',
      description: 'Pagamento teste',
      entryDate: '2025-01-15',
    })

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/panorama')
  })

  it('rejeita valor zero ou negativo', async () => {
    const charge = await createCharge(db, userId, personId)

    const { updateDebtEntry } = await import('@/lib/actions/debtors')
    await expect(
      updateDebtEntry({
        id: charge.id,
        amount: '0',
        description: 'Cobrança teste',
        entryDate: '2025-01-10',
      })
    ).rejects.toThrow()
  })
})
