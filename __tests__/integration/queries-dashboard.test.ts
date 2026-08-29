import { vi, describe, it, expect, beforeAll } from 'vitest'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { billingCycleDateRange } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
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
const MONTH_FATURA_BUDGET_MATCH = '2025-10-01'
const YEAR_MONTH_CYCLE_BUDGET_MATCH = '2025-11'

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

// ─── getDashboardData / getDashboardDataBillingCycle — orçamento e drill-down
// vêm do mesmo conjunto (issue #113) ──────────────────────────────────────────

describe('getDashboardData/getDashboardDataBillingCycle — budgetTransactions bate com groupProgress', () => {
  let accountCreditId: string
  let catFaturaId: string

  beforeAll(async () => {
    ;({ id: accountCreditId } = await createAccount(db, userAId, {
      type: 'credit',
      closingDay: 10,
    }))
    ;({ id: catFaturaId } = await createCategory(db, userAId, groupAId, {
      name: 'Fatura Teste',
      defaultBudget: '500.00',
    }))
  })

  it('em regime de fatura, budgetTransactions/budgetFixedExpenses excluem crédito e somam exatamente o spent de groupProgress', async () => {
    await createTransaction(db, userAId, accountAId, {
      amount: '250.00',
      referenceMonth: MONTH_FATURA_BUDGET_MATCH,
      date: '2025-10-05',
      categoryId: catFaturaId,
    })
    await createTransaction(db, userAId, accountCreditId, {
      amount: '300.00',
      referenceMonth: MONTH_FATURA_BUDGET_MATCH,
      date: '2025-10-12',
      categoryId: catFaturaId,
    })
    await createTransaction(db, userAId, accountCreditId, {
      amount: '400.00',
      referenceMonth: MONTH_FATURA_BUDGET_MATCH,
      date: '2025-10-20',
      categoryId: catFaturaId,
    })
    // Gasto fixo no crédito — o predicado precisa excluir também deste lado
    // (fxWhere aplica o mesmo notInArray que txWhere, lib/queries/dashboard.ts)
    await createFixedExpense(db, userAId, accountCreditId, catFaturaId, {
      amount: '80.00',
      referenceMonth: MONTH_FATURA_BUDGET_MATCH,
    })

    const { getDashboardData } = await import('@/lib/queries/dashboard')
    const data = await getDashboardData(userAId, MONTH_FATURA_BUDGET_MATCH, {
      creditMode: 'fatura',
      faturaActiveFrom: '2025-01-01',
      creditAccountIds: [accountCreditId],
    })

    const group = data.groupProgress.find((g) => g.id === groupAId)
    const cat = group?.categories.find((c) => c.id === catFaturaId)
    expect(cat).toBeDefined()
    expect(cat!.spent).toBeCloseTo(250, 1)

    expect(data.creditFilteredFromBudget).toBe(true)

    // O conjunto do drill-down precisa somar exatamente o mesmo valor da barra —
    // não a lista crua, que ainda tem os itens de crédito (usados por TransactionList).
    const budgetSum =
      data.budgetTransactions
        .filter((t) => t.categoryId === catFaturaId)
        .reduce((s, t) => s + toAmount(t.amount), 0) +
      data.budgetFixedExpenses
        .filter((fe) => fe.categoryId === catFaturaId)
        .reduce((s, fe) => s + toAmount(fe.amount), 0)
    expect(budgetSum).toBeCloseTo(cat!.spent, 1)

    // A lista crua continua com os itens de crédito — é o que TransactionList usa
    // para exibir o selo "via fatura"; não deve ser usada pelo dialog de orçamento.
    const rawSum =
      data.transactions
        .filter((t) => t.categoryId === catFaturaId)
        .reduce((s, t) => s + toAmount(t.amount), 0) +
      data.fixedExpenses
        .filter((fe) => fe.categoryId === catFaturaId)
        .reduce((s, fe) => s + toAmount(fe.amount), 0)
    expect(rawSum).toBeCloseTo(1030, 1)
  })

  it('na visão de ciclo, budgetTransactions reflete o mês de calendário inteiro, não o ciclo de uma conta', async () => {
    const closingDay = 10
    const cycleRange = billingCycleDateRange(YEAR_MONTH_CYCLE_BUDGET_MATCH, closingDay)!

    // Conta e categoria próprias deste teste: a janela do ciclo (2025-10-10 a
    // 2025-11-09) atravessa o mês de MONTH_FATURA_BUDGET_MATCH, então reusar
    // accountCreditId/catFaturaId capturaria as transações de outubro do teste
    // anterior — isolamento por referenceMonth não isola a visão de ciclo.
    const { id: accountCycleId } = await createAccount(db, userAId, {
      type: 'credit',
      closingDay,
    })
    const { id: catCycleId } = await createCategory(db, userAId, groupAId, {
      name: 'Ciclo Teste',
      defaultBudget: '500.00',
    })

    // Fora do ciclo (que termina em 2025-11-09), mas dentro do mês de calendário
    await createTransaction(db, userAId, accountAId, {
      amount: '550.00',
      referenceMonth: '2025-11-01',
      date: '2025-11-15',
      categoryId: catCycleId,
    })
    // Dentro do ciclo
    await createTransaction(db, userAId, accountCycleId, {
      amount: '400.00',
      referenceMonth: '2025-11-01',
      date: '2025-11-05',
      categoryId: catCycleId,
    })

    const { getDashboardDataBillingCycle } = await import('@/lib/queries/dashboard')
    const data = await getDashboardDataBillingCycle(
      userAId,
      YEAR_MONTH_CYCLE_BUDGET_MATCH,
      closingDay,
      cycleRange,
      accountCycleId
    )

    const group = data.groupProgress.find((g) => g.id === groupAId)
    const cat = group?.categories.find((c) => c.id === catCycleId)
    expect(cat).toBeDefined()
    // groupProgress aqui é o mês de calendário inteiro, todas as contas: 550 + 400
    expect(cat!.spent).toBeCloseTo(950, 1)

    expect(data.creditFilteredFromBudget).toBe(false)

    const budgetSum = data.budgetTransactions
      .filter((t) => t.categoryId === catCycleId)
      .reduce((s, t) => s + toAmount(t.amount), 0)
    expect(budgetSum).toBeCloseTo(cat!.spent, 1)

    // A lista do ciclo (TransactionList) continua restrita à conta e à janela do ciclo
    const cycleSum = data.transactions
      .filter((t) => t.categoryId === catCycleId)
      .reduce((s, t) => s + toAmount(t.amount), 0)
    expect(cycleSum).toBeCloseTo(400, 1)
  })
})
