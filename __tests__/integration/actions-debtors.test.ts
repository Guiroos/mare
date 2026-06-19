import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest'
import { and, eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createCharge } from './helpers/factories'

// UUID válido que nunca existirá no banco — passa a validação Zod mas ownership rejeita
const FOREIGN_UUID = '00000000-0000-0000-0000-000000000000'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsCategoryGroup: vi.fn(),
  assertOwnsCategory: vi.fn(),
  assertOwnsPaymentAccount: vi.fn(),
  assertOwnsInvestmentType: vi.fn(),
  assertOwnsGoal: vi.fn(),
  assertOwnsPerson: vi.fn(),
  assertOwnsDebtEntry: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let personId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-debtors-${Date.now()}`))
  ;({ id: personId } = await createPerson(db, userId))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const { assertOwnsPerson, assertOwnsDebtEntry } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsPerson).mockResolvedValue(undefined)
  vi.mocked(assertOwnsDebtEntry).mockResolvedValue(undefined)
})

// Restaura o mock de requireUserId para o valor padrão após cada teste de auth
afterEach(async () => {
  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
})

describe('settleCharge', () => {
  it('cria payment e marca charge como settled atomicamente', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Almoço',
      amount: '150.00',
      entryDate: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    const { settleCharge } = await import('@/lib/actions/debtors')
    await settleCharge({
      chargeId: charge.id,
      personId,
      entryDate: '2025-03-20',
      createIncome: false,
    })

    const settled = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    expect(settled?.status).toBe('settled')
    expect(settled?.settledByPaymentId).not.toBeNull()

    const payment = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, settled!.settledByPaymentId!),
    })

    expect(payment?.type).toBe('payment')
    expect(payment?.amount).toBe('150.00')
    expect(payment?.incomeId).toBeNull()
  })

  it('com createIncome=true cria income e payment compartilham incomeId', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Jantar',
      amount: '200.00',
      entryDate: '2025-04-05',
      referenceMonth: '2025-04-01',
    })

    const { settleCharge } = await import('@/lib/actions/debtors')
    await settleCharge({
      chargeId: charge.id,
      personId,
      entryDate: '2025-04-15',
      createIncome: true,
      referenceMonth: '2025-04-01',
    })

    const settled = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    expect(settled?.status).toBe('settled')

    const payment = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, settled!.settledByPaymentId!),
    })

    expect(payment?.incomeId).not.toBeNull()

    const income = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, payment!.incomeId!),
    })

    expect(income).toBeDefined()
    expect(income?.amount).toBe('200.00')
    expect(income?.referenceMonth).toBe('2025-04-01')
  })

  it('rejeita cobrança já quitada', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Quitada previamente',
      amount: '50.00',
      entryDate: '2025-05-01',
      referenceMonth: '2025-05-01',
    })

    await db
      .update(schema.debtorEntries)
      .set({ status: 'settled' })
      .where(eq(schema.debtorEntries.id, charge.id))

    const { settleCharge } = await import('@/lib/actions/debtors')
    await expect(
      settleCharge({ chargeId: charge.id, personId, entryDate: '2025-05-10', createIncome: false })
    ).rejects.toThrow('Cobrança já está quitada')
  })
})

describe('deleteDebtEntry', () => {
  it('ao deletar payment, reseta charges vinculadas para open', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Transporte',
      amount: '80.00',
      entryDate: '2025-06-01',
      referenceMonth: '2025-06-01',
    })

    // Quitar via action para ter um cenário realista
    const { settleCharge, deleteDebtEntry } = await import('@/lib/actions/debtors')
    await settleCharge({
      chargeId: charge.id,
      personId,
      entryDate: '2025-06-10',
      createIncome: false,
    })

    const settled = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })
    const paymentId = settled!.settledByPaymentId!

    // Deletar o payment via action
    await deleteDebtEntry({ id: paymentId })

    const reopened = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })

    expect(reopened?.status).toBe('open')
    expect(reopened?.settledByPaymentId).toBeNull()

    const deletedPayment = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, paymentId),
    })
    expect(deletedPayment).toBeUndefined()
  })

  it('ao deletar payment com alsoDeleteIncome, remove o income vinculado', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Refeição',
      amount: '120.00',
      entryDate: '2025-07-01',
      referenceMonth: '2025-07-01',
    })

    const { settleCharge, deleteDebtEntry } = await import('@/lib/actions/debtors')
    await settleCharge({
      chargeId: charge.id,
      personId,
      entryDate: '2025-07-10',
      createIncome: true,
      referenceMonth: '2025-07-01',
    })

    const settled = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })
    const payment = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, settled!.settledByPaymentId!),
    })
    const incomeId = payment!.incomeId!

    await deleteDebtEntry({ id: payment!.id, alsoDeleteIncome: true })

    const deletedIncome = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, incomeId),
    })
    expect(deletedIncome).toBeUndefined()
  })
})

describe('createDebtPayment', () => {
  it('com createIncome=true cria income e payment com incomeId correto', async () => {
    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await createDebtPayment({
      personId,
      amount: '300.00',
      description: 'Pagamento direto',
      entryDate: '2025-08-15',
      createIncome: true,
      referenceMonth: '2025-08-01',
    })

    const payment = await db.query.debtorEntries.findFirst({
      where: and(
        eq(schema.debtorEntries.userId, userId),
        eq(schema.debtorEntries.type, 'payment'),
        eq(schema.debtorEntries.entryDate, '2025-08-15')
      ),
    })

    expect(payment).toBeDefined()
    expect(payment?.incomeId).not.toBeNull()

    const income = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, payment!.incomeId!),
    })

    expect(income).toBeDefined()
    expect(income?.amount).toBe('300.00')
    expect(income?.referenceMonth).toBe('2025-08-01')
  })

  it('com settleChargeIds vincula e quita as charges especificadas', async () => {
    const c1 = await createCharge(db, userId, personId, {
      description: 'Charge para quitar A',
      amount: '60.00',
      entryDate: '2025-09-01',
      referenceMonth: '2025-09-01',
    })
    const c2 = await createCharge(db, userId, personId, {
      description: 'Charge para quitar B',
      amount: '40.00',
      entryDate: '2025-09-02',
      referenceMonth: '2025-09-01',
    })
    // Charge de outra pessoa — não deve ser afetada
    const otherPerson = await createPerson(db, userId, 'Outra Pessoa Pagamento')
    const cOther = await createCharge(db, userId, otherPerson.id, {
      description: 'Charge não vinculada',
      entryDate: '2025-09-01',
      referenceMonth: '2025-09-01',
    })

    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await createDebtPayment({
      personId,
      amount: '100.00',
      description: 'Pagamento agrupado',
      entryDate: '2025-09-10',
      createIncome: false,
      settleChargeIds: [c1.id, c2.id],
    })

    const settled1 = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, c1.id),
    })
    const settled2 = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, c2.id),
    })
    const untouched = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, cOther.id),
    })

    expect(settled1?.status).toBe('settled')
    expect(settled1?.settledByPaymentId).not.toBeNull()
    expect(settled2?.status).toBe('settled')
    expect(untouched?.status).toBe('open')
    expect(untouched?.settledByPaymentId).toBeNull()
  })
})

// ─── auth e ownership — rejeições ─────────────────────────────────────────────

describe('auth — usuário não autenticado', () => {
  it('settleCharge rejeita sem sessão ativa', async () => {
    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockRejectedValueOnce(new Error('Não autenticado'))

    const charge = await createCharge(db, userId, personId, {
      description: 'Charge auth test',
      entryDate: '2025-10-01',
      referenceMonth: '2025-10-01',
    })

    const { settleCharge } = await import('@/lib/actions/debtors')
    await expect(
      settleCharge({ chargeId: charge.id, personId, entryDate: '2025-10-10', createIncome: false })
    ).rejects.toThrow('Não autenticado')
  })

  it('createDebtCharge rejeita sem sessão ativa', async () => {
    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockRejectedValueOnce(new Error('Não autenticado'))

    const { createDebtCharge } = await import('@/lib/actions/debtors')
    await expect(
      createDebtCharge({
        personId,
        amount: '50.00',
        description: 'Cobrança sem auth',
        entryDate: '2025-10-01',
      })
    ).rejects.toThrow('Não autenticado')
  })

  it('deleteDebtEntry rejeita sem sessão ativa', async () => {
    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockRejectedValueOnce(new Error('Não autenticado'))

    const { deleteDebtEntry } = await import('@/lib/actions/debtors')
    await expect(deleteDebtEntry({ id: 'qualquer-id' })).rejects.toThrow('Não autenticado')
  })
})

describe('ownership — acesso negado', () => {
  it('settleCharge rejeita quando person não pertence ao usuário', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPerson).mockRejectedValueOnce(new Error('Forbidden'))

    const charge = await createCharge(db, userId, personId, {
      description: 'Charge ownership test',
      entryDate: '2025-11-01',
      referenceMonth: '2025-11-01',
    })

    const { settleCharge } = await import('@/lib/actions/debtors')
    await expect(
      settleCharge({
        chargeId: charge.id,
        personId: FOREIGN_UUID,
        entryDate: '2025-11-10',
        createIncome: false,
      })
    ).rejects.toThrow('Forbidden')
  })

  it('settleCharge rejeita quando a charge não pertence ao usuário', async () => {
    const { assertOwnsDebtEntry } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsDebtEntry).mockRejectedValueOnce(new Error('Forbidden'))

    const { settleCharge } = await import('@/lib/actions/debtors')
    await expect(
      settleCharge({
        chargeId: FOREIGN_UUID,
        personId,
        entryDate: '2025-11-10',
        createIncome: false,
      })
    ).rejects.toThrow('Forbidden')
  })

  it('createDebtPayment rejeita quando person não pertence ao usuário', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPerson).mockRejectedValueOnce(new Error('Forbidden'))

    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await expect(
      createDebtPayment({
        personId: FOREIGN_UUID,
        amount: '100.00',
        description: 'Pagamento bloqueado',
        entryDate: '2025-11-01',
        createIncome: false,
      })
    ).rejects.toThrow('Forbidden')
  })

  it('deleteDebtEntry rejeita quando entry não pertence ao usuário', async () => {
    const { assertOwnsDebtEntry } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsDebtEntry).mockRejectedValueOnce(new Error('Forbidden'))

    const { deleteDebtEntry } = await import('@/lib/actions/debtors')
    await expect(deleteDebtEntry({ id: FOREIGN_UUID })).rejects.toThrow('Forbidden')
  })
})

describe('ownership — chamada com IDs corretos', () => {
  it('settleCharge chama assertOwnsDebtEntry com userId e chargeId corretos', async () => {
    const { assertOwnsDebtEntry } = await import('@/lib/auth/ownership')

    const charge = await createCharge(db, userId, personId, {
      description: 'Charge IDs test',
      entryDate: '2025-12-01',
      referenceMonth: '2025-12-01',
    })

    const { settleCharge } = await import('@/lib/actions/debtors')
    await settleCharge({
      chargeId: charge.id,
      personId,
      entryDate: '2025-12-10',
      createIncome: false,
    })

    expect(vi.mocked(assertOwnsDebtEntry)).toHaveBeenCalledWith(userId, charge.id)
  })

  it('settleCharge chama assertOwnsPerson com userId e personId corretos', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')

    const charge = await createCharge(db, userId, personId, {
      description: 'Charge person IDs test',
      entryDate: '2026-01-01',
      referenceMonth: '2026-01-01',
    })

    const { settleCharge } = await import('@/lib/actions/debtors')
    await settleCharge({
      chargeId: charge.id,
      personId,
      entryDate: '2026-01-10',
      createIncome: false,
    })

    expect(vi.mocked(assertOwnsPerson)).toHaveBeenCalledWith(userId, personId)
  })

  it('createDebtCharge chama assertOwnsPerson com userId e personId corretos', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')

    const { createDebtCharge } = await import('@/lib/actions/debtors')
    await createDebtCharge({
      personId,
      amount: '75.00',
      description: 'Cobrança IDs test',
      entryDate: '2026-02-01',
    })

    expect(vi.mocked(assertOwnsPerson)).toHaveBeenCalledWith(userId, personId)
  })
})

describe('validação de input', () => {
  it('createDebtCharge rejeita input inválido sem escrever no banco', async () => {
    const countBefore = await db
      .select({ id: schema.debtorEntries.id })
      .from(schema.debtorEntries)
      .where(eq(schema.debtorEntries.userId, userId))

    const { createDebtCharge } = await import('@/lib/actions/debtors')
    await expect(
      createDebtCharge({
        personId,
        amount: '-50',
        description: '',
        entryDate: 'data-invalida',
      })
    ).rejects.toThrow()

    const countAfter = await db
      .select({ id: schema.debtorEntries.id })
      .from(schema.debtorEntries)
      .where(eq(schema.debtorEntries.userId, userId))

    expect(countAfter).toHaveLength(countBefore.length)
  })

  it('createDebtPayment rejeita amount negativo sem escrever no banco', async () => {
    const countBefore = await db
      .select({ id: schema.debtorEntries.id })
      .from(schema.debtorEntries)
      .where(eq(schema.debtorEntries.userId, userId))

    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await expect(
      createDebtPayment({
        personId,
        amount: '-100',
        description: 'Pagamento inválido',
        entryDate: '2026-03-01',
        createIncome: false,
      })
    ).rejects.toThrow()

    const countAfter = await db
      .select({ id: schema.debtorEntries.id })
      .from(schema.debtorEntries)
      .where(eq(schema.debtorEntries.userId, userId))

    expect(countAfter).toHaveLength(countBefore.length)
  })
})
