import { vi, describe, it, expect, beforeAll } from 'vitest'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { pastNMonths } from '@/lib/utils/date'
import {
  createUser,
  createCategoryGroup,
  createCategory,
  createAccount,
  createTransaction,
  createFixedExpense,
  createIncome,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

neonTestingSetup()

let db: TestDb

// Usuário A — dono dos dados principais
let userAId: string
let groupAId: string
let catAId: string
let accountAId: string

// Usuário B — deve ser completamente opaco para as queries do usuário A
let userBId: string
let catBId: string
let accountBId: string

// Cada bloco de testes usa um mês diferente para evitar contaminação de dados
const MONTH_INCOME_ISOLATION = '2025-03-01'
const MONTH_MONTH_ISOLATION = '2025-04-01'
const MONTH_MONTH_OTHER = '2025-05-01'
const MONTH_BUDGET_DEFAULT = '2025-06-01'
const MONTH_BUDGET_OVERRIDE = '2025-07-01'
const MONTH_SPENT_ACCUMULATION = '2025-08-01'
const MONTH_SPENT_ISOLATION = '2025-09-01'

beforeAll(async () => {
  db = createTestDb()

  const suffix = Date.now()
  ;({ id: userAId } = await createUser(db, `dashboard-a-${suffix}`))
  ;({ id: userBId } = await createUser(db, `dashboard-b-${suffix}`))

  // Infra usuário A
  const groupA = await createCategoryGroup(db, userAId, 'Alimentação')
  groupAId = groupA.id
  ;({ id: catAId } = await createCategory(db, userAId, groupAId, {
    name: 'Supermercado',
    defaultBudget: '500.00',
  }))
  ;({ id: accountAId } = await createAccount(db, userAId))

  // Infra usuário B (grupos e contas separadas — IDs distintos)
  const groupB = await createCategoryGroup(db, userBId, 'Lazer')
  ;({ id: catBId } = await createCategory(db, userBId, groupB.id, { name: 'Cinema' }))
  ;({ id: accountBId } = await createAccount(db, userBId))
})

// ─── getDashboardData — isolamento por userId ─────────────────────────────────

describe('getDashboardData — isolamento por userId', () => {
  beforeAll(async () => {
    // Usuário A: R$ 3.000 de receita
    await createIncome(db, userAId, {
      amount: '3000.00',
      referenceMonth: MONTH_INCOME_ISOLATION,
    })
    // Usuário B: R$ 9.999 de receita — não deve vazar para A
    await createIncome(db, userBId, {
      amount: '9999.00',
      referenceMonth: MONTH_INCOME_ISOLATION,
    })

    // Usuário A: R$ 200 de transação
    await createTransaction(db, userAId, accountAId, {
      amount: '200.00',
      referenceMonth: MONTH_INCOME_ISOLATION,
      date: '2025-03-10',
      categoryId: catAId,
    })
    // Usuário B: R$ 8.888 de transação
    await createTransaction(db, userBId, accountBId, {
      amount: '8888.00',
      referenceMonth: MONTH_INCOME_ISOLATION,
      date: '2025-03-10',
      categoryId: catBId,
    })

    // Usuário A: R$ 150 de gasto fixo
    await createFixedExpense(db, userAId, accountAId, catAId, {
      amount: '150.00',
      referenceMonth: MONTH_INCOME_ISOLATION,
    })
    // Usuário B: R$ 7.777 de gasto fixo
    await createFixedExpense(db, userBId, accountBId, catBId, {
      amount: '7777.00',
      referenceMonth: MONTH_INCOME_ISOLATION,
    })
  })

  it('totalIncomes soma apenas receitas do usuário correto', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_INCOME_ISOLATION)

    expect(data.summary.totalIncomes).toBeCloseTo(3000, 1)
  })

  it('lista de incomes contém apenas registros do usuário A', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_INCOME_ISOLATION)

    expect(data.incomes.every((i) => i.userId === userAId)).toBe(true)
  })

  it('lista de transactions não contém registros do usuário B', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_INCOME_ISOLATION)

    const hasB = data.transactions.some((t) => t.userId === userBId)
    expect(hasB).toBe(false)
  })

  it('lista de fixedExpenses não contém registros do usuário B', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_INCOME_ISOLATION)

    const hasB = data.fixedExpenses.some((e) => e.userId === userBId)
    expect(hasB).toBe(false)
  })
})

// ─── getDashboardData — isolamento por referenceMonth ────────────────────────

describe('getDashboardData — isolamento por referenceMonth', () => {
  beforeAll(async () => {
    // Mesmo usuário A, meses diferentes
    await createIncome(db, userAId, {
      amount: '5000.00',
      referenceMonth: MONTH_MONTH_ISOLATION,
    })
    await createIncome(db, userAId, {
      amount: '9000.00',
      referenceMonth: MONTH_MONTH_OTHER,
    })

    await createTransaction(db, userAId, accountAId, {
      amount: '400.00',
      referenceMonth: MONTH_MONTH_ISOLATION,
      date: '2025-04-15',
      categoryId: catAId,
    })
    await createTransaction(db, userAId, accountAId, {
      amount: '8000.00',
      referenceMonth: MONTH_MONTH_OTHER,
      date: '2025-05-05',
      categoryId: catAId,
    })
  })

  it('totalIncomes do mês correto não inclui receitas de outro mês', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_MONTH_ISOLATION)

    // A receita de MONTH_MONTH_OTHER (R$ 9.000) não deve somar
    expect(data.summary.totalIncomes).toBeCloseTo(5000, 1)
  })

  it('lista de incomes contém apenas registros do mês solicitado', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_MONTH_ISOLATION)

    const contaminated = data.incomes.some((i) => i.referenceMonth !== MONTH_MONTH_ISOLATION)
    expect(contaminated).toBe(false)
  })

  it('lista de transactions contém apenas registros do mês solicitado', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_MONTH_ISOLATION)

    const contaminated = data.transactions.some((t) => t.referenceMonth !== MONTH_MONTH_ISOLATION)
    expect(contaminated).toBe(false)
  })

  it('totalExpenses reflete apenas o mês solicitado', async () => {
    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_MONTH_ISOLATION)

    // Apenas a transação de R$ 400 deve entrar — não a de R$ 8.000 do outro mês
    expect(data.summary.totalExpenses).toBeCloseTo(400, 1)
  })
})

// ─── getCategoryGroupProgress — orçamento padrão vs override ─────────────────

describe('getCategoryGroupProgress — orçamento padrão e override mensal', () => {
  it('usa defaultBudget quando não há override para o mês', async () => {
    // catA tem defaultBudget = 500.00; sem override para MONTH_BUDGET_DEFAULT
    const { getCategoryGroupProgress } = await import('@/lib/queries/dashboard')
    const data = await getCategoryGroupProgress(userAId, MONTH_BUDGET_DEFAULT)

    const group = data.find((g) => g.id === groupAId)
    const cat = group?.categories.find((c) => c.id === catAId)

    expect(cat).toBeDefined()
    expect(cat!.budget).toBeCloseTo(500, 1)
  })

  it('usa o override quando existe para o mês', async () => {
    // Inserir override de R$ 750 para o mês alvo
    await db.insert(schema.monthlyBudgetOverrides).values({
      userId: userAId,
      categoryId: catAId,
      referenceMonth: MONTH_BUDGET_OVERRIDE,
      amount: '750.00',
    })

    const { getCategoryGroupProgress } = await import('@/lib/queries/dashboard')
    const data = await getCategoryGroupProgress(userAId, MONTH_BUDGET_OVERRIDE)

    const group = data.find((g) => g.id === groupAId)
    const cat = group?.categories.find((c) => c.id === catAId)

    expect(cat).toBeDefined()
    expect(cat!.budget).toBeCloseTo(750, 1)
  })

  it('totalSpent acumula transações e gastos fixos da mesma categoria', async () => {
    // R$ 120 via transação + R$ 80 via gasto fixo = R$ 200
    await createTransaction(db, userAId, accountAId, {
      amount: '120.00',
      referenceMonth: MONTH_SPENT_ACCUMULATION,
      date: '2025-08-10',
      categoryId: catAId,
    })
    await createFixedExpense(db, userAId, accountAId, catAId, {
      amount: '80.00',
      referenceMonth: MONTH_SPENT_ACCUMULATION,
    })

    const { getCategoryGroupProgress } = await import('@/lib/queries/dashboard')
    const data = await getCategoryGroupProgress(userAId, MONTH_SPENT_ACCUMULATION)

    const group = data.find((g) => g.id === groupAId)
    const cat = group?.categories.find((c) => c.id === catAId)

    expect(cat).toBeDefined()
    expect(cat!.spent).toBeCloseTo(200, 1)
  })

  it('gastos de outro usuário não contaminam totalSpent do usuário A', async () => {
    // Usuário A: R$ 300
    await createTransaction(db, userAId, accountAId, {
      amount: '300.00',
      referenceMonth: MONTH_SPENT_ISOLATION,
      date: '2025-09-05',
      categoryId: catAId,
    })
    // Usuário B: R$ 9.999 em categoria própria — não deve aparecer no progresso de A
    await createTransaction(db, userBId, accountBId, {
      amount: '9999.00',
      referenceMonth: MONTH_SPENT_ISOLATION,
      date: '2025-09-05',
      categoryId: catBId,
    })

    const { getCategoryGroupProgress } = await import('@/lib/queries/dashboard')
    const data = await getCategoryGroupProgress(userAId, MONTH_SPENT_ISOLATION)

    // Retorna apenas grupos do usuário A
    expect(data.map((g) => g.id)).toContain(groupAId)

    // totalSpent do grupo de A reflete apenas os R$ 300
    const group = data.find((g) => g.id === groupAId)
    expect(group!.totalSpent).toBeCloseTo(300, 1)
  })
})

// ─── getMonthlyEvolution — definição de "conta de crédito" em modo fatura ────
// Regressão da issue #36: `getMonthlyEvolution` excluía qualquer conta
// `type='credit'`, enquanto `getDashboardData` só exclui as que também têm
// `closingDay > 1` (definição canônica, vinda de `getCreditAccounts`). Um
// cartão sem dia de fechamento configurado ficava fora de `creditAccountIds`
// mas ainda assim desaparecia do gráfico de evolução mensal.

describe('getMonthlyEvolution — conta de crédito sem closingDay não é excluída em modo fatura', () => {
  it('despesa em cartão fora de creditAccountIds soma normalmente; a configurada é excluída', async () => {
    const { id: userId } = await createUser(db, `evolution-fatura-${Date.now()}`)
    const { id: configuredCreditId } = await createAccount(db, userId, {
      name: 'Cartão configurado',
      type: 'credit',
      closingDay: 10,
    })
    const { id: unconfiguredCreditId } = await createAccount(db, userId, {
      name: 'Cartão sem fechamento',
      type: 'credit',
      closingDay: null,
    })
    const { id: debitId } = await createAccount(db, userId, { type: 'debit' })
    const { id: groupId } = await createCategoryGroup(db, userId)
    const { id: catId } = await createCategory(db, userId, groupId)

    const [refMonth] = pastNMonths(1)
    const day15 = `${refMonth.slice(0, 7)}-15`

    await createTransaction(db, userId, debitId, {
      amount: '100.00',
      referenceMonth: refMonth,
      date: day15,
      categoryId: catId,
    })
    await createTransaction(db, userId, configuredCreditId, {
      amount: '500.00',
      referenceMonth: refMonth,
      date: day15,
      categoryId: catId,
    })
    await createTransaction(db, userId, unconfiguredCreditId, {
      amount: '450.00',
      referenceMonth: refMonth,
      date: day15,
      categoryId: catId,
    })
    // Gasto fixo no cartão sem fechamento — deve somar (mesma correção, outra tabela)
    await createFixedExpense(db, userId, unconfiguredCreditId, catId, {
      amount: '80.00',
      referenceMonth: refMonth,
    })
    // Gasto fixo no cartão configurado — deve ser excluído
    await createFixedExpense(db, userId, configuredCreditId, catId, {
      amount: '300.00',
      referenceMonth: refMonth,
    })

    const { getMonthlyEvolution } = await import('@/lib/queries/dashboard')
    // creditAccountIds reflete getCreditAccounts: só a conta com closingDay > 1 entra
    const evolution = await getMonthlyEvolution(userId, 1, {
      creditMode: 'fatura',
      faturaActiveFrom: refMonth,
      creditAccountIds: [configuredCreditId],
    })

    const month = evolution.find((m) => m.month === refMonth.slice(0, 7))
    expect(month).toBeDefined()
    // R$ 100 (débito) + R$ 450 (transação, cartão sem fechamento) + R$ 80 (gasto fixo,
    // cartão sem fechamento) = R$ 630. Exclui a transação (R$ 500) e o gasto fixo
    // (R$ 300) do cartão configurado — cobre as duas queries que a correção mudou.
    expect(month!.totalExpenses).toBeCloseTo(630, 1)
  })
})
