import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
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
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

neonTestingSetup()

// Dia fixo: 21/jun/2025 — dia 21, entre os fechamentos dia 10 e dia 25.
// Com closingDay=10 e hoje=dia 21:
//   aberto   = 10/jun → 09/jul  (cycleMonth = 2025-07-01)
//   fechado  = 10/mai → 09/jun  (cycleMonth = 2025-06-01)
//   histórico (faturaActiveFrom=mai): 10/abr → 09/mai (cycleMonth = 2025-05-01)
const TODAY = new Date('2025-06-21T12:00:00Z')

let db: TestDb

beforeAll(() => {
  db = createTestDb()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
})

afterAll(() => {
  vi.useRealTimers()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupUser(name: string) {
  const { id: userId } = await createUser(db, name)
  const { id: creditId } = await createAccount(db, userId, {
    name: 'Cartão',
    type: 'credit',
    closingDay: 10,
  })
  const { id: debitId } = await createAccount(db, userId, { name: 'Conta', type: 'debit' })
  const { id: groupId } = await createCategoryGroup(db, userId)
  const { id: catId } = await createCategory(db, userId, groupId)
  return { userId, creditId, debitId, catId }
}

async function enableFatura(userId: string, faturaActiveFrom: string) {
  await db
    .insert(schema.userSettings)
    .values({ userId, creditMode: 'fatura', faturaActiveFrom, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.userSettings.userId],
      set: { creditMode: 'fatura', faturaActiveFrom, updatedAt: new Date() },
    })
}

// ─── Ciclo aberto ─────────────────────────────────────────────────────────────
// Transação datada 15/jun → cai no ciclo aberto (10/jun→09/jul).
// O ciclo fechado (10/mai→09/jun) fica zerado.

describe('getOpenFaturas — transação após o fechamento vai para ciclo aberto', () => {
  let userId: string
  let creditId: string

  beforeAll(async () => {
    let catId: string
    ;({ userId, creditId, catId } = await setupUser('fq-open'))
    await enableFatura(userId, '2025-06-01')
    await createTransaction(db, userId, creditId, {
      amount: '150.00',
      date: '2025-06-15',
      referenceMonth: '2025-06-01',
      categoryId: catId,
    })
  })

  it('openCycle.total inclui a transação', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.openCycle.total).toBeCloseTo(150, 1)
  })

  it('closedCycle.total = 0 — sem gastos em 10/mai→09/jun', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.closedCycle.total).toBe(0)
  })

  it('sem overdueCycles — faturaActiveFrom é o mês corrente', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.overdueCycles).toHaveLength(0)
  })
})

// ─── Ciclo fechado ────────────────────────────────────────────────────────────
// Transação datada 01/jun → cai no ciclo fechado (10/mai→09/jun), sem pagamento.

describe('getOpenFaturas — transação antes do fechamento vai para ciclo fechado', () => {
  let userId: string
  let creditId: string

  beforeAll(async () => {
    let catId: string
    ;({ userId, creditId, catId } = await setupUser('fq-closed'))
    await enableFatura(userId, '2025-06-01')
    await createTransaction(db, userId, creditId, {
      amount: '200.00',
      date: '2025-06-01',
      referenceMonth: '2025-06-01',
      categoryId: catId,
    })
  })

  it('closedCycle.total inclui a transação', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.closedCycle.total).toBeCloseTo(200, 1)
  })

  it('closedCycle.payment = null enquanto fatura não está paga', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.closedCycle.payment).toBeNull()
  })
})

// ─── Ciclo fechado pago ───────────────────────────────────────────────────────
// Gasto no ciclo fechado + pagamento registrado → payment não é null.

describe('getOpenFaturas — ciclo fechado pago registra o pagamento', () => {
  let userId: string
  let creditId: string

  beforeAll(async () => {
    let debitId: string, catId: string
    ;({ userId, creditId, debitId, catId } = await setupUser('fq-paid'))
    await enableFatura(userId, '2025-06-01')
    await createTransaction(db, userId, creditId, {
      amount: '300.00',
      date: '2025-06-01',
      referenceMonth: '2025-06-01',
      categoryId: catId,
    })
    await createTransaction(db, userId, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-06-01',
      categoryId: null,
      name: 'Pagamento fatura jun',
      amount: '300.00',
      date: '2025-06-20',
      referenceMonth: '2025-06-01',
    })
  })

  it('closedCycle.payment não é null e reflete o valor pago', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.closedCycle.payment).not.toBeNull()
    expect(fatura.closedCycle.payment?.amount).toBeCloseTo(300, 1)
  })
})

// ─── Retroatividade: ciclo histórico não pago ─────────────────────────────────
// faturaActiveFrom=mai → histórico mai = 10/abr→09/mai.
// Transação em 20/abr → deve aparecer em overdueCycles.

describe('getOpenFaturas — retroatividade: ciclo histórico com gastos sem pagamento', () => {
  let userId: string
  let creditId: string

  beforeAll(async () => {
    let catId: string
    ;({ userId, creditId, catId } = await setupUser('fq-retro-unpaid'))
    await enableFatura(userId, '2025-05-01')
    await createTransaction(db, userId, creditId, {
      amount: '100.00',
      date: '2025-04-20',
      referenceMonth: '2025-04-01',
      categoryId: catId,
    })
  })

  it('overdueCycles tem 1 entrada com o total e cycleMonth corretos', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-05-01')
    expect(fatura.overdueCycles).toHaveLength(1)
    expect(fatura.overdueCycles[0].total).toBeCloseTo(100, 1)
    expect(fatura.overdueCycles[0].cycleMonth).toBe('2025-05-01')
  })
})

// ─── Retroatividade: ciclo histórico vazio é ignorado ─────────────────────────
// faturaActiveFrom=mai → histórico mai = 10/abr→09/mai.
// Sem transações nesse range → overdueCycles vazio.

describe('getOpenFaturas — retroatividade: ciclo histórico sem gastos não aparece', () => {
  let userId: string

  beforeAll(async () => {
    ;({ userId } = await setupUser('fq-retro-empty'))
    await enableFatura(userId, '2025-05-01')
    // nenhuma transação no range 10/abr→09/mai
  })

  it('overdueCycles é vazio', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-05-01')
    expect(fatura.overdueCycles).toHaveLength(0)
  })
})

// ─── Retroatividade: ciclo histórico pago ─────────────────────────────────────
// Gasto no histórico mai + pagamento registrado → não aparece em overdueCycles.

describe('getOpenFaturas — retroatividade: ciclo histórico pago não é overdue', () => {
  let userId: string
  let creditId: string

  beforeAll(async () => {
    let debitId: string, catId: string
    ;({ userId, creditId, debitId, catId } = await setupUser('fq-retro-paid'))
    await enableFatura(userId, '2025-05-01')
    await createTransaction(db, userId, creditId, {
      amount: '100.00',
      date: '2025-04-20',
      referenceMonth: '2025-04-01',
      categoryId: catId,
    })
    await createTransaction(db, userId, debitId, {
      faturaAccountId: creditId,
      faturaCycleMonth: '2025-05-01',
      categoryId: null,
      name: 'Pagamento histórico mai',
      amount: '100.00',
      date: '2025-05-15',
      referenceMonth: '2025-05-01',
    })
  })

  it('overdueCycles é vazio pois o ciclo foi pago', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-05-01')
    expect(fatura.overdueCycles).toHaveLength(0)
  })
})

// ─── Gastos fixos: alocação por dueDay vs closingDay ─────────────────────────
// closingDay=10, referenceMonth=jun:
//   dueDay=5  (< 10)  → ciclo fechado  (10/mai→09/jun, refMonth=jun AND dueDay<10)
//   dueDay=15 (>= 10) → ciclo aberto   (10/jun→09/jul, prevRefMonth=jun AND dueDay>=10)

describe('getOpenFaturas — gastos fixos alocados pelo dueDay em relação ao closingDay', () => {
  let userId: string
  let creditId: string

  beforeAll(async () => {
    let catId: string
    ;({ userId, creditId, catId } = await setupUser('fq-fixed'))
    await enableFatura(userId, '2025-06-01')
    await createFixedExpense(db, userId, creditId, catId, {
      amount: '50.00',
      dueDay: 5,
      referenceMonth: '2025-06-01',
    })
    await createFixedExpense(db, userId, creditId, catId, {
      amount: '80.00',
      dueDay: 15,
      referenceMonth: '2025-06-01',
    })
  })

  it('dueDay < closingDay → fixedExpenseTotal no ciclo fechado', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.closedCycle.fixedExpenseTotal).toBeCloseTo(50, 1)
  })

  it('dueDay >= closingDay → fixedExpenseTotal no ciclo aberto', async () => {
    const { getOpenFaturas } = await import('@/lib/queries/fatura')
    const [fatura] = await getOpenFaturas(userId, '2025-06-01')
    expect(fatura.openCycle.fixedExpenseTotal).toBeCloseTo(80, 1)
  })
})

// ─── getDashboardData: exclusão de crédito por faturaActiveFrom ───────────────
// Junho (>= faturaActiveFrom): transação de crédito excluída do totalExpenses.
// Maio  (< faturaActiveFrom): transação de crédito incluída normalmente.

describe('getDashboardData — transações de crédito excluídas a partir de faturaActiveFrom', () => {
  let userId: string
  let creditId: string
  let debitId: string
  let catId: string

  beforeAll(async () => {
    ;({ userId, creditId, debitId, catId } = await setupUser('fq-dashboard'))
    await enableFatura(userId, '2025-06-01')

    // Junho: débito R$ 200 (deve aparecer) + crédito R$ 500 (excluído em fatura mode)
    await createTransaction(db, userId, debitId, {
      amount: '200.00',
      date: '2025-06-10',
      referenceMonth: '2025-06-01',
      categoryId: catId,
    })
    await createTransaction(db, userId, creditId, {
      amount: '500.00',
      date: '2025-06-15',
      referenceMonth: '2025-06-01',
      categoryId: catId,
    })

    // Maio (antes de faturaActiveFrom): crédito R$ 300 (modo accrual, deve aparecer)
    await createTransaction(db, userId, creditId, {
      amount: '300.00',
      date: '2025-05-20',
      referenceMonth: '2025-05-01',
      categoryId: catId,
    })
  })

  it('junho: totalExpenses exclui transações do cartão de crédito', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userId, '2025-06-01', {
      creditMode: 'fatura',
      faturaActiveFrom: '2025-06-01',
      creditAccountIds: [creditId],
    })
    expect(data.summary.totalExpenses).toBeCloseTo(200, 1)
  })

  it('maio: totalExpenses inclui crédito pois referenceMonth < faturaActiveFrom', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userId, '2025-05-01', {
      creditMode: 'fatura',
      faturaActiveFrom: '2025-06-01',
      creditAccountIds: [creditId],
    })
    expect(data.summary.totalExpenses).toBeCloseTo(300, 1)
  })
})
