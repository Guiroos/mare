import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createCategoryGroup, createCategory, createAccount } from './helpers/factories'

neonTestingSetup()

// Data fixa para testes determinísticos; só faz fake de Date, sem interferir em timers async
const FAKE_NOW = new Date('2025-06-15T12:00:00')
const CURRENT_MONTH = '2025-06-01'
const PREV_MONTH = '2025-05-01'
const PREV2_MONTH = '2025-04-01'
const NEXT_MONTH = '2025-07-01'
const NEXT2_MONTH = '2025-08-01'

let db: TestDb
let userId: string
let categoryId: string
let accountId: string
let getActiveInstallmentGroups: (typeof import('@/lib/queries/parcelas'))['getActiveInstallmentGroups']
let getInstallmentTimeline: (typeof import('@/lib/queries/parcelas'))['getInstallmentTimeline']

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FAKE_NOW)

  db = createTestDb()
  ;({ id: userId } = await createUser(db, `queries-parcelas-${Date.now()}`))
  const catGroup = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, catGroup.id))
  ;({ id: accountId } = await createAccount(db, userId))

  // Dynamic import: lib/db só é resolvido aqui, após neon-testing setar DATABASE_URL
  ;({ getActiveInstallmentGroups, getInstallmentTimeline } = await import('@/lib/queries/parcelas'))
})

afterAll(() => {
  vi.useRealTimers()
})

// Cria grupo + transações diretamente no DB com valores em plain text
// (decryptField retorna plain text como-está por compatibilidade)
async function seedGroup(months: string[], totalAmount: string, name = 'Compra Teste') {
  const totalInstallments = months.length
  const [group] = await db
    .insert(schema.installmentGroups)
    .values({
      userId,
      accountId,
      categoryId,
      name,
      totalAmount,
      totalInstallments,
      startDate: months[0],
    })
    .returning({ id: schema.installmentGroups.id })

  const installmentAmount = (parseFloat(totalAmount) / totalInstallments).toFixed(2)

  for (let i = 0; i < months.length; i++) {
    await db.insert(schema.transactions).values({
      userId,
      accountId,
      categoryId,
      installmentGroupId: group.id,
      name: `${name} (${i + 1}/${totalInstallments})`,
      amount: installmentAmount,
      date: months[i],
      referenceMonth: months[i],
      installmentNumber: i + 1,
      totalInstallments,
    })
  }

  return group.id
}

// ─── getActiveInstallmentGroups ───────────────────────────────────────────────

describe('getActiveInstallmentGroups', () => {
  it('inclui grupo cuja última parcela é o mês atual', async () => {
    // Bug anterior: mês atual era contado como "pago" (<=), zerando remainingInstallments
    const groupId = await seedGroup([PREV2_MONTH, PREV_MONTH, CURRENT_MONTH], '300.00', 'TV')

    const groups = await getActiveInstallmentGroups(userId)
    const group = groups.find((g) => g.id === groupId)

    expect(group).toBeDefined()
    expect(group!.remainingInstallments).toBe(1)
    expect(group!.paidInstallments).toBe(2)
  })

  it('exclui grupo cuja última parcela foi no mês anterior', async () => {
    const groupId = await seedGroup([PREV2_MONTH, PREV_MONTH], '200.00', 'Sofá')

    const groups = await getActiveInstallmentGroups(userId)
    const group = groups.find((g) => g.id === groupId)

    expect(group).toBeUndefined()
  })

  it('inclui grupo com parcelas no mês atual e futuros', async () => {
    const groupId = await seedGroup([CURRENT_MONTH, NEXT_MONTH, NEXT2_MONTH], '300.00', 'Notebook')

    const groups = await getActiveInstallmentGroups(userId)
    const group = groups.find((g) => g.id === groupId)

    expect(group).toBeDefined()
    expect(group!.remainingInstallments).toBe(3)
    expect(group!.paidInstallments).toBe(0)
  })

  it('installmentAmount é arredondado a 2 casas decimais', async () => {
    // 100 / 3 = 33.333... → deve ser 33.33
    const groupId = await seedGroup(
      [CURRENT_MONTH, NEXT_MONTH, NEXT2_MONTH],
      '100.00',
      'Indivisível'
    )

    const groups = await getActiveInstallmentGroups(userId)
    const group = groups.find((g) => g.id === groupId)

    expect(group).toBeDefined()
    expect(group!.installmentAmount).toBe(33.33)
    // Garante que não é float puro (33.333...)
    expect(group!.installmentAmount.toString()).not.toContain('333')
  })

  it('remainingAmount reflete corretamente parcelas pendentes', async () => {
    // 3 parcelas de R$ 120 = R$ 40 cada; 2 restantes = R$ 80
    const groupId = await seedGroup([PREV_MONTH, CURRENT_MONTH, NEXT_MONTH], '120.00', 'Geladeira')

    const groups = await getActiveInstallmentGroups(userId)
    const group = groups.find((g) => g.id === groupId)

    expect(group).toBeDefined()
    expect(group!.remainingInstallments).toBe(2)
    expect(group!.remainingAmount).toBeCloseTo(80, 2)
  })
})

// ─── getInstallmentTimeline ───────────────────────────────────────────────────

describe('getInstallmentTimeline', () => {
  it('mês atual aparece no timeline', async () => {
    await seedGroup([CURRENT_MONTH, NEXT_MONTH], '200.00', 'Timeline Atual')

    const timeline = await getInstallmentTimeline(userId)
    const currentEntry = timeline.find((e) => e.month === CURRENT_MONTH.slice(0, 7))

    expect(currentEntry).toBeDefined()
    expect(currentEntry!.total).toBeGreaterThan(0)
  })

  it('meses passados não aparecem no timeline', async () => {
    await seedGroup([PREV2_MONTH, PREV_MONTH], '200.00', 'Só Passado')

    const timeline = await getInstallmentTimeline(userId)
    const pastEntry = timeline.find((e) => e.month === PREV_MONTH.slice(0, 7))

    expect(pastEntry).toBeUndefined()
  })

  it('total do mês soma todas as parcelas daquele mês', async () => {
    // Dois grupos com parcela no mesmo mês futuro específico
    const TARGET_MONTH = NEXT2_MONTH
    await seedGroup([TARGET_MONTH], '100.00', 'Timeline A')
    await seedGroup([TARGET_MONTH], '50.00', 'Timeline B')

    const timeline = await getInstallmentTimeline(userId)
    const entry = timeline.find((e) => e.month === TARGET_MONTH.slice(0, 7))

    expect(entry).toBeDefined()
    // Total deve incluir as duas parcelas (pode ter outras do mesmo mês de testes anteriores)
    expect(entry!.total).toBeGreaterThanOrEqual(150)
    expect(entry!.groups.length).toBeGreaterThanOrEqual(2)
  })

  it('mês além do horizonte de 12 meses não aparece no timeline', async () => {
    // Cria 14 meses de parcelas; os meses 13 e 14 ficam fora do horizonte
    const farMonth = '2026-08-01'
    await db.insert(schema.transactions).values({
      userId,
      accountId,
      categoryId,
      name: 'Longe demais',
      amount: '50.00',
      date: farMonth,
      referenceMonth: farMonth,
    })

    const timeline = await getInstallmentTimeline(userId)
    const farEntry = timeline.find((e) => e.month === farMonth.slice(0, 7))

    // futureNMonths(12) com FAKE_NOW=2025-06 vai até 2026-05 — 2026-08 fica fora
    expect(farEntry).toBeUndefined()
  })
})
