import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest'
import { and, eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createCategoryGroup,
  createCategory,
  createAccount,
  createGoal,
  createTrip,
  createIncome,
  createInstallmentGroup,
  createTransaction,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsCategory: vi.fn(),
  assertOwnsPaymentAccount: vi.fn(),
  assertOwnsPerson: vi.fn(),
  assertOwnsTrip: vi.fn(),
  assertOwnsGoal: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let otherUserId: string
let categoryId: string
let accountId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-trips-${Date.now()}`))
  ;({ id: otherUserId } = await createUser(db, `actions-trips-other-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
  ;({ id: accountId } = await createAccount(db, userId))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const ownership = await import('@/lib/auth/ownership')
  vi.mocked(ownership.assertOwnsCategory).mockResolvedValue(undefined)
  vi.mocked(ownership.assertOwnsPaymentAccount).mockResolvedValue(undefined)
  vi.mocked(ownership.assertOwnsPerson).mockResolvedValue(undefined)
  vi.mocked(ownership.assertOwnsTrip).mockResolvedValue(undefined)
  vi.mocked(ownership.assertOwnsGoal).mockResolvedValue(undefined)
})

afterEach(async () => {
  const { assertOwnsTrip, assertOwnsGoal } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsTrip).mockClear()
  vi.mocked(assertOwnsGoal).mockClear()
})

async function decrypt(value: string) {
  const { getDekForUser } = await import('@/lib/crypto/keys')
  const { decryptField } = await import('@/lib/crypto/fields')
  return decryptField(value, await getDekForUser(userId))
}

// ─── upsertTrip ───────────────────────────────────────────────────────────────

describe('upsertTrip', () => {
  it('cria a viagem com nome cifrado e aparado', async () => {
    const { upsertTrip } = await import('@/lib/actions/trips')
    await upsertTrip({ name: '  Lisboa  ', startDate: '2025-06-01', endDate: '2025-06-10' })

    const rows = await db
      .select()
      .from(schema.trips)
      .where(and(eq(schema.trips.userId, userId), eq(schema.trips.startDate, '2025-06-01')))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.name.startsWith('enc:')).toBe(true)
    expect(await decrypt(rows[0]!.name)).toBe('Lisboa')
    expect(rows[0]!.endDate).toBe('2025-06-10')
  })

  it('verifica a posse da meta antes de vincular e não grava se ela for alheia', async () => {
    const goal = await createGoal(db, userId)
    const { assertOwnsGoal } = await import('@/lib/auth/ownership')
    const { upsertTrip } = await import('@/lib/actions/trips')

    await upsertTrip({ name: 'Com meta', startDate: '2025-07-01', goalId: goal.id })
    expect(assertOwnsGoal).toHaveBeenCalledWith(userId, goal.id)

    vi.mocked(assertOwnsGoal).mockRejectedValueOnce(new Error('Não autorizado'))
    await expect(
      upsertTrip({ name: 'Meta alheia', startDate: '2025-07-02', goalId: goal.id })
    ).rejects.toThrow('Não autorizado')

    const rejected = await db
      .select()
      .from(schema.trips)
      .where(and(eq(schema.trips.userId, userId), eq(schema.trips.startDate, '2025-07-02')))
    expect(rejected).toHaveLength(0)
  })

  it('atualiza a própria viagem', async () => {
    const trip = await createTrip(db, userId, { name: 'Antes', startDate: '2025-01-01' })
    const { upsertTrip } = await import('@/lib/actions/trips')

    await upsertTrip({ existingId: trip.id, name: 'Depois', startDate: '2025-02-01' })

    const [row] = await db.select().from(schema.trips).where(eq(schema.trips.id, trip.id))
    expect(await decrypt(row!.name)).toBe('Depois')
    expect(row!.startDate).toBe('2025-02-01')
  })

  it('não altera viagem de outro usuário mesmo recebendo o id dela', async () => {
    const foreign = await createTrip(db, otherUserId, {
      name: 'Viagem alheia',
      startDate: '2025-01-01',
    })
    const { upsertTrip } = await import('@/lib/actions/trips')

    await upsertTrip({ existingId: foreign.id, name: 'Sequestrada', startDate: '2025-12-31' })

    const [row] = await db.select().from(schema.trips).where(eq(schema.trips.id, foreign.id))
    expect(row!.userId).toBe(otherUserId)
    expect(row!.name).toBe('Viagem alheia')
    expect(row!.startDate).toBe('2025-01-01')

    // Também não pode cair no ramo de insert e criar uma cópia para o usuário atual
    const created = await db
      .select()
      .from(schema.trips)
      .where(and(eq(schema.trips.userId, userId), eq(schema.trips.startDate, '2025-12-31')))
    expect(created).toHaveLength(0)
  })
})

// ─── deleteTrip ───────────────────────────────────────────────────────────────

describe('deleteTrip', () => {
  it('apaga a viagem e mantém os lançamentos, só com tripId nulo', async () => {
    const trip = await createTrip(db, userId)
    const tx = await createTransaction(db, userId, accountId, { categoryId, tripId: trip.id })
    const income = await createIncome(db, userId, { tripId: trip.id })
    const group = await createInstallmentGroup(db, userId, accountId, categoryId, {
      tripId: trip.id,
    })
    const [installment] = await db
      .insert(schema.transactions)
      .values({
        userId,
        accountId,
        categoryId,
        tripId: trip.id,
        installmentGroupId: group.id,
        installmentNumber: 1,
        totalInstallments: 3,
        name: 'Parcela (1/3)',
        amount: '100.00',
        date: '2025-01-10',
        referenceMonth: '2025-01-01',
      })
      .returning({ id: schema.transactions.id })

    const { deleteTrip } = await import('@/lib/actions/trips')
    await deleteTrip(trip.id)

    const [trips, txRows, incomeRows, groupRows] = await Promise.all([
      db.select().from(schema.trips).where(eq(schema.trips.id, trip.id)),
      db
        .select({ id: schema.transactions.id, tripId: schema.transactions.tripId })
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId)),
      db.select().from(schema.incomes).where(eq(schema.incomes.id, income.id)),
      db.select().from(schema.installmentGroups).where(eq(schema.installmentGroups.id, group.id)),
    ])

    expect(trips).toHaveLength(0)

    const survivors = txRows.filter((r) => r.id === tx.id || r.id === installment!.id)
    expect(survivors).toHaveLength(2)
    expect(survivors.every((r) => r.tripId === null)).toBe(true)

    expect(incomeRows).toHaveLength(1)
    expect(incomeRows[0]!.tripId).toBeNull()

    expect(groupRows).toHaveLength(1)
    expect(groupRows[0]!.tripId).toBeNull()
  })

  it('não apaga viagem de outro usuário', async () => {
    const foreign = await createTrip(db, otherUserId)
    const { deleteTrip } = await import('@/lib/actions/trips')

    await deleteTrip(foreign.id)

    const rows = await db.select().from(schema.trips).where(eq(schema.trips.id, foreign.id))
    expect(rows).toHaveLength(1)
  })
})

// ─── tripId nos lançamentos ───────────────────────────────────────────────────

describe('tripId nos lançamentos', () => {
  it('createTransaction grava o tripId e verifica a posse da viagem', async () => {
    const trip = await createTrip(db, userId)
    const { assertOwnsTrip } = await import('@/lib/auth/ownership')
    const { createTransaction } = await import('@/lib/actions/transactions')

    await createTransaction({
      name: 'Jantar',
      amount: '80.00',
      date: '2025-03-10',
      categoryId,
      accountId,
      tripId: trip.id,
    })

    expect(assertOwnsTrip).toHaveBeenCalledWith(userId, trip.id)
    const rows = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.tripId, trip.id))
    expect(rows).toHaveLength(1)
    expect(await decrypt(rows[0]!.name)).toBe('Jantar')
  })

  it('createTransaction não grava nada quando a viagem é alheia', async () => {
    const trip = await createTrip(db, userId)
    const { assertOwnsTrip } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsTrip).mockRejectedValueOnce(new Error('Não autorizado'))
    const { createTransaction } = await import('@/lib/actions/transactions')

    await expect(
      createTransaction({
        name: 'Jantar',
        amount: '80.00',
        date: '2025-03-10',
        categoryId,
        accountId,
        tripId: trip.id,
      })
    ).rejects.toThrow('Não autorizado')

    const rows = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.tripId, trip.id))
    expect(rows).toHaveLength(0)
  })

  it('createInstallmentPurchase grava o tripId no grupo e em todas as parcelas', async () => {
    const trip = await createTrip(db, userId)
    const { assertOwnsTrip } = await import('@/lib/auth/ownership')
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'Hotel',
      totalAmount: '900.00',
      totalInstallments: 3,
      startDate: '2025-03-05',
      categoryId,
      accountId,
      tripId: trip.id,
    })

    expect(assertOwnsTrip).toHaveBeenCalledWith(userId, trip.id)

    const [groups, installments] = await Promise.all([
      db
        .select()
        .from(schema.installmentGroups)
        .where(eq(schema.installmentGroups.tripId, trip.id)),
      db.select().from(schema.transactions).where(eq(schema.transactions.tripId, trip.id)),
    ])
    expect(groups).toHaveLength(1)
    expect(installments).toHaveLength(3)
    expect(installments.every((t) => t.installmentGroupId === groups[0]!.id)).toBe(true)
  })

  it('createIncome grava o tripId e verifica a posse da viagem', async () => {
    const trip = await createTrip(db, userId)
    const { assertOwnsTrip } = await import('@/lib/auth/ownership')
    const { createIncome: createIncomeAction } = await import('@/lib/actions/incomes')

    await createIncomeAction({
      source: 'Reembolso',
      amount: '150.00',
      referenceMonth: '2025-03-01',
      tripId: trip.id,
    })

    expect(assertOwnsTrip).toHaveBeenCalledWith(userId, trip.id)
    const rows = await db.select().from(schema.incomes).where(eq(schema.incomes.tripId, trip.id))
    expect(rows).toHaveLength(1)
    expect(await decrypt(rows[0]!.source)).toBe('Reembolso')
  })

  it('updateInstallmentGroup repassa o tripId a todas as parcelas e limpar a viagem limpa todas', async () => {
    const trip = await createTrip(db, userId)
    const { createInstallmentPurchase, updateInstallmentGroup } =
      await import('@/lib/actions/transactions')

    // Parcelado criado sem viagem; startDate único para localizar o grupo
    await createInstallmentPurchase({
      name: 'Passagem',
      totalAmount: '1200.00',
      totalInstallments: 4,
      startDate: '2025-08-17',
      categoryId,
      accountId,
    })
    const [group] = await db
      .select()
      .from(schema.installmentGroups)
      .where(
        and(
          eq(schema.installmentGroups.userId, userId),
          eq(schema.installmentGroups.startDate, '2025-08-17')
        )
      )

    const children = () =>
      db
        .select({ tripId: schema.transactions.tripId })
        .from(schema.transactions)
        .where(eq(schema.transactions.installmentGroupId, group!.id))
    const groupTripId = async () =>
      (
        await db
          .select({ tripId: schema.installmentGroups.tripId })
          .from(schema.installmentGroups)
          .where(eq(schema.installmentGroups.id, group!.id))
      )[0]!.tripId

    await updateInstallmentGroup({
      id: group!.id,
      name: 'Passagem',
      categoryId,
      accountId,
      tripId: trip.id,
    })

    expect(await groupTripId()).toBe(trip.id)
    const linked = await children()
    expect(linked).toHaveLength(4)
    expect(linked.every((t) => t.tripId === trip.id)).toBe(true)

    await updateInstallmentGroup({ id: group!.id, name: 'Passagem', categoryId, accountId })

    expect(await groupTripId()).toBeNull()
    const cleared = await children()
    expect(cleared).toHaveLength(4)
    expect(cleared.every((t) => t.tripId === null)).toBe(true)
  })
})
