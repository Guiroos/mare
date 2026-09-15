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
  createGoal,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let otherUserId: string
let accountId: string
let otherAccountId: string
let mercadoId: string
let hospedagemId: string
let otherCategoryId: string
let enc: (value: string) => string

let getTrips: (typeof import('@/lib/queries/trips'))['getTrips']
let getTripDetail: (typeof import('@/lib/queries/trips'))['getTripDetail']

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `queries-trips-${Date.now()}`))
  ;({ id: otherUserId } = await createUser(db, `queries-trips-other-${Date.now()}`))

  const group = await createCategoryGroup(db, userId)
  ;({ id: accountId } = await createAccount(db, userId))

  const otherGroup = await createCategoryGroup(db, otherUserId)
  ;({ id: otherAccountId } = await createAccount(db, otherUserId))
  ;({ id: otherCategoryId } = await createCategory(db, otherUserId, otherGroup.id))

  // Dynamic import: lib/db só é resolvido aqui, após neon-testing setar DATABASE_URL
  const { getDekForUser } = await import('@/lib/crypto/keys')
  const { encryptField } = await import('@/lib/crypto/fields')
  const dek = await getDekForUser(userId)
  // Seed cifrado de propósito: plaintext passaria pelo decryptField como-está e o
  // teste de decrypt não distinguiria query que decifra de query que não decifra.
  enc = (value: string) => encryptField(value, dek)
  ;({ id: mercadoId } = await createCategory(db, userId, group.id, { name: enc('Mercado') }))
  ;({ id: hospedagemId } = await createCategory(db, userId, group.id, {
    name: enc('Hospedagem'),
  }))
  ;({ getTrips, getTripDetail } = await import('@/lib/queries/trips'))
})

async function seedTrip(overrides: Partial<typeof schema.trips.$inferInsert> = {}) {
  const [trip] = await db
    .insert(schema.trips)
    .values({ userId, name: enc('Viagem'), ...overrides })
    .returning({ id: schema.trips.id })
  return trip
}

async function seedTx(overrides: Partial<typeof schema.transactions.$inferInsert> = {}) {
  await db.insert(schema.transactions).values({
    userId,
    accountId,
    categoryId: mercadoId,
    name: enc('Gasto'),
    amount: enc('10.00'),
    date: '2025-03-10',
    referenceMonth: '2025-03-01',
    ...overrides,
  })
}

// Parcelado 3x com parcelas em meses diferentes, todas marcadas com a viagem —
// é o formato que createInstallmentPurchase grava.
async function seedInstallments(tripId: string, amounts: [string, string, string]) {
  const [group] = await db
    .insert(schema.installmentGroups)
    .values({
      userId,
      accountId,
      categoryId: hospedagemId,
      tripId,
      name: enc('Hotel'),
      totalAmount: enc('900.00'),
      totalInstallments: 3,
      startDate: '2025-03-05',
    })
    .returning({ id: schema.installmentGroups.id })

  const months = ['2025-03-01', '2025-04-01', '2025-05-01']
  await db.insert(schema.transactions).values(
    months.map((referenceMonth, i) => ({
      userId,
      accountId,
      categoryId: hospedagemId,
      tripId,
      installmentGroupId: group.id,
      installmentNumber: i + 1,
      totalInstallments: 3,
      name: enc(`Hotel (${i + 1}/3)`),
      amount: enc(amounts[i]),
      date: referenceMonth.replace(/01$/, '05'),
      referenceMonth,
    }))
  )
}

describe('getTripDetail', () => {
  it('soma todas as parcelas do parcelado, inclusive as de meses futuros', async () => {
    const trip = await seedTrip({ name: enc('Lisboa') })
    await seedInstallments(trip.id, ['300.00', '300.00', '300.00'])

    const detail = await getTripDetail(userId, trip.id)

    // Filtrar pelo mês corrente ou pela 1ª parcela daria 300, não 900
    expect(detail?.totalSpent).toBe(900)
    expect(detail?.transactions).toHaveLength(3)
  })

  it('separa entradas dos gastos e agrupa os gastos por categoria', async () => {
    const trip = await seedTrip({ name: enc('Porto') })
    await seedInstallments(trip.id, ['300.00', '300.00', '300.50'])
    await seedTx({ tripId: trip.id, categoryId: mercadoId, amount: enc('120.25') })
    await seedTx({ tripId: trip.id, categoryId: mercadoId, amount: enc('79.75') })
    await db.insert(schema.incomes).values([
      {
        userId,
        tripId: trip.id,
        source: enc('Reembolso'),
        amount: enc('150.00'),
        referenceMonth: '2025-03-01',
      },
      {
        userId,
        tripId: trip.id,
        source: enc('Diária'),
        amount: enc('50.00'),
        referenceMonth: '2025-04-01',
      },
    ])

    const detail = await getTripDetail(userId, trip.id)

    expect(detail?.totalSpent).toBeCloseTo(1100.5, 2)
    expect(detail?.totalIncome).toBeCloseTo(200, 2)
    expect(detail?.incomes).toHaveLength(2)

    // Ordenado por valor decrescente, com nomes decifrados
    expect(detail?.categoryBreakdown).toEqual([
      { categoryId: hospedagemId, categoryName: 'Hospedagem', amount: expect.closeTo(900.5, 2) },
      { categoryId: mercadoId, categoryName: 'Mercado', amount: expect.closeTo(200, 2) },
    ])
  })

  it('ignora lançamentos sem viagem, de outra viagem e de outro usuário', async () => {
    const trip = await seedTrip()
    const otherTrip = await seedTrip()
    await seedTx({ tripId: trip.id, amount: enc('40.00') })
    await seedTx({ tripId: null, amount: enc('1000.00') })
    await seedTx({ tripId: otherTrip.id, amount: enc('2000.00') })
    await db.insert(schema.incomes).values({
      userId,
      tripId: otherTrip.id,
      source: enc('Outra'),
      amount: enc('500.00'),
      referenceMonth: '2025-03-01',
    })
    // O FK trip_id não amarra usuário: só o filtro por userId da query impede a soma
    await db.insert(schema.transactions).values({
      userId: otherUserId,
      accountId: otherAccountId,
      categoryId: otherCategoryId,
      tripId: trip.id,
      name: 'Intruso',
      amount: '5000.00',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })

    const detail = await getTripDetail(userId, trip.id)

    expect(detail?.totalSpent).toBe(40)
    expect(detail?.totalIncome).toBe(0)
    expect(detail?.transactions).toHaveLength(1)
  })

  it('devolve nome, valores e fontes decifrados', async () => {
    const trip = await seedTrip({ name: enc('Buenos Aires') })
    await seedTx({ tripId: trip.id, name: enc('Jantar'), amount: enc('88.90') })
    await db.insert(schema.incomes).values({
      userId,
      tripId: trip.id,
      source: enc('Rateio'),
      amount: enc('44.45'),
      referenceMonth: '2025-03-01',
    })

    const [raw] = await db.select().from(schema.trips).where(eq(schema.trips.id, trip.id))
    expect(raw!.name.startsWith('enc:')).toBe(true)

    const detail = await getTripDetail(userId, trip.id)

    expect(detail?.name).toBe('Buenos Aires')
    expect(detail?.transactions[0]).toMatchObject({ name: 'Jantar', amount: 88.9 })
    expect(detail?.incomes[0]).toMatchObject({ source: 'Rateio', amount: 44.45 })
  })

  it('devolve null para viagem de outro usuário', async () => {
    const [foreign] = await db
      .insert(schema.trips)
      .values({ userId: otherUserId, name: 'Viagem alheia' })
      .returning({ id: schema.trips.id })

    expect(await getTripDetail(userId, foreign!.id)).toBeNull()
  })

  it('traz nome e saldo da meta vinculada', async () => {
    const goal = await createGoal(db, userId, { name: enc('Fundo viagem') })
    await db.insert(schema.goalContributions).values({
      userId,
      goalId: goal.id,
      amount: enc('750.00'),
      referenceMonth: '2025-01-01',
      source: 'manual',
    })
    const trip = await seedTrip({ goalId: goal.id })

    const detail = await getTripDetail(userId, trip.id)

    expect(detail?.goalName).toBe('Fundo viagem')
    expect(detail?.goalBalance).toBeCloseTo(750, 2)
  })
})

describe('getTrips', () => {
  let tripsUserId: string
  let tripsAccountId: string
  let tripsCategoryId: string

  // Usuário dedicado: getTrips lista todas as viagens do usuário, e as dos testes
  // de getTripDetail poluiriam as asserções de lista e ordenação.
  beforeAll(async () => {
    ;({ id: tripsUserId } = await createUser(db, `queries-trips-list-${Date.now()}`))
    const group = await createCategoryGroup(db, tripsUserId)
    ;({ id: tripsCategoryId } = await createCategory(db, tripsUserId, group.id))
    ;({ id: tripsAccountId } = await createAccount(db, tripsUserId))
  })

  it('soma o total de cada viagem com o parcelado inteiro, decifra e ordena', async () => {
    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { encryptField } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(tripsUserId)
    const e = (v: string) => encryptField(v, dek)

    const [antiga, recente, semData] = await db
      .insert(schema.trips)
      .values([
        { userId: tripsUserId, name: e('Antiga'), startDate: '2024-07-01' },
        { userId: tripsUserId, name: e('Recente'), startDate: '2025-03-01' },
        { userId: tripsUserId, name: e('Sem data') },
      ])
      .returning({ id: schema.trips.id })

    const base = {
      userId: tripsUserId,
      accountId: tripsAccountId,
      categoryId: tripsCategoryId,
      name: e('Gasto'),
    }
    await db.insert(schema.transactions).values([
      // Parcelado 3x na viagem recente, meses diferentes
      {
        ...base,
        tripId: recente!.id,
        amount: e('300.00'),
        date: '2025-03-05',
        referenceMonth: '2025-03-01',
      },
      {
        ...base,
        tripId: recente!.id,
        amount: e('300.00'),
        date: '2025-04-05',
        referenceMonth: '2025-04-01',
      },
      {
        ...base,
        tripId: recente!.id,
        amount: e('300.00'),
        date: '2025-05-05',
        referenceMonth: '2025-05-01',
      },
      {
        ...base,
        tripId: antiga!.id,
        amount: e('75.50'),
        date: '2024-07-02',
        referenceMonth: '2024-07-01',
      },
      {
        ...base,
        tripId: null,
        amount: e('999.00'),
        date: '2025-03-05',
        referenceMonth: '2025-03-01',
      },
    ])
    // Lançamento de outro usuário apontando para a viagem: só o filtro por userId o exclui
    await db.insert(schema.transactions).values({
      userId: otherUserId,
      accountId: otherAccountId,
      categoryId: otherCategoryId,
      tripId: recente!.id,
      name: 'Intruso',
      amount: '5000.00',
      date: '2025-03-10',
      referenceMonth: '2025-03-01',
    })
    // Entrada não conta como gasto
    await db.insert(schema.incomes).values({
      userId: tripsUserId,
      tripId: recente!.id,
      source: e('Reembolso'),
      amount: e('100.00'),
      referenceMonth: '2025-03-01',
    })

    const list = await getTrips(tripsUserId)

    expect(list.map((t) => t.name)).toEqual(['Recente', 'Antiga', 'Sem data'])
    expect(list.find((t) => t.id === recente!.id)?.totalSpent).toBe(900)
    expect(list.find((t) => t.id === antiga!.id)?.totalSpent).toBe(75.5)
    expect(list.find((t) => t.id === semData!.id)?.totalSpent).toBe(0)
  })

  it('não lista viagens de outro usuário', async () => {
    const [foreign] = await db
      .insert(schema.trips)
      .values({ userId: otherUserId, name: 'Viagem alheia na lista' })
      .returning({ id: schema.trips.id })

    const list = await getTrips(tripsUserId)

    expect(list.some((t) => t.id === foreign!.id)).toBe(false)
  })
})
