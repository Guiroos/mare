import { vi, describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createCategoryGroup,
  createCategory,
  createAccount,
  createTransaction,
  createFixedExpense,
  createIncome,
  createInstallmentGroup,
  createGoal,
  createInvestmentType,
  createGoalContribution,
  createPerson,
  createCharge,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `reset-account-${Date.now()}`))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
})

describe('resetAccount', () => {
  it('apaga todos os dados financeiros do usuário', async () => {
    // Seed: criar dados em todas as tabelas relevantes
    const group = await createCategoryGroup(db, userId)
    const category = await createCategory(db, userId, group.id)
    const account = await createAccount(db, userId)

    await createTransaction(db, userId, account.id, { categoryId: category.id })
    await createFixedExpense(db, userId, account.id, category.id)
    await createIncome(db, userId)

    const installGroup = await createInstallmentGroup(db, userId, account.id, category.id)
    await db.insert(schema.transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      installmentGroupId: installGroup.id,
      name: 'Parcela 1/2',
      amount: '150.00',
      date: '2025-01-10',
      referenceMonth: '2025-01-01',
    })

    const goal = await createGoal(db, userId)
    const investType = await createInvestmentType(db, userId)
    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: investType.id,
      amount: '500.00',
      referenceMonth: '2025-01-01',
    })
    await createGoalContribution(db, userId, goal.id)

    const person = await createPerson(db, userId)
    await createCharge(db, userId, person.id)

    const { resetAccount } = await import('@/lib/actions/reset-account')
    await resetAccount()

    // Verificar que todos os dados foram apagados
    const [
      txs,
      fixedExpenses,
      incomes,
      installGroups,
      investments,
      withdrawals,
      goals,
      investTypes,
      goalContribs,
      debtorEntries,
      people,
      accounts,
    ] = await Promise.all([
      db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId)),
      db.select().from(schema.fixedExpenses).where(eq(schema.fixedExpenses.userId, userId)),
      db.select().from(schema.incomes).where(eq(schema.incomes.userId, userId)),
      db.select().from(schema.installmentGroups).where(eq(schema.installmentGroups.userId, userId)),
      db.select().from(schema.investments).where(eq(schema.investments.userId, userId)),
      db
        .select()
        .from(schema.investmentWithdrawals)
        .where(eq(schema.investmentWithdrawals.userId, userId)),
      db.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
      db.select().from(schema.investmentTypes).where(eq(schema.investmentTypes.userId, userId)),
      db.select().from(schema.goalContributions).where(eq(schema.goalContributions.userId, userId)),
      db.select().from(schema.debtorEntries).where(eq(schema.debtorEntries.userId, userId)),
      db.select().from(schema.people).where(eq(schema.people.userId, userId)),
      db.select().from(schema.paymentAccounts).where(eq(schema.paymentAccounts.userId, userId)),
    ])

    expect(txs).toHaveLength(0)
    expect(fixedExpenses).toHaveLength(0)
    expect(incomes).toHaveLength(0)
    expect(installGroups).toHaveLength(0)
    expect(investments).toHaveLength(0)
    expect(withdrawals).toHaveLength(0)
    expect(goals).toHaveLength(0)
    expect(investTypes).toHaveLength(0)
    expect(goalContribs).toHaveLength(0)
    expect(debtorEntries).toHaveLength(0)
    expect(people).toHaveLength(0)
    expect(accounts).toHaveLength(0)
  })

  it('recria os 2 grupos e 17 categorias padrão com os orçamentos corretos', async () => {
    // resetAccount já foi chamado no teste anterior — o estado é limpo + reseed feito
    const groups = await db
      .select()
      .from(schema.categoryGroups)
      .where(eq(schema.categoryGroups.userId, userId))
      .orderBy(schema.categoryGroups.sortOrder)

    expect(groups).toHaveLength(2)
    expect(groups[0]!.name).toBe('Essencial')
    expect(groups[1]!.name).toBe('Estilo de Vida')

    const cats = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId))

    expect(cats).toHaveLength(17)

    const mercado = cats.find((c) => c.name === 'Mercado')
    expect(mercado?.defaultBudget).toBe('350.00')

    const lazer = cats.find((c) => c.name === 'Lazer')
    expect(lazer?.defaultBudget).toBe('700.00')

    const aluguel = cats.find((c) => c.name === 'Aluguel')
    expect(aluguel?.defaultBudget).toBeNull()
  })

  it('não apaga categorias de outro usuário', async () => {
    const { id: otherUserId } = await createUser(db, `reset-other-${Date.now()}`)
    const otherGroup = await createCategoryGroup(db, otherUserId, 'Grupo Outro')
    await createCategory(db, otherUserId, otherGroup.id, { name: 'Cat Outro' })

    const { resetAccount } = await import('@/lib/actions/reset-account')
    await resetAccount()

    const otherCats = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.userId, otherUserId))

    expect(otherCats).toHaveLength(1)
    expect(otherCats[0]!.name).toBe('Cat Outro')
  })

  it('é idempotente — resetar duas vezes mantém as categorias padrão', async () => {
    const { resetAccount } = await import('@/lib/actions/reset-account')
    await resetAccount()

    const cats = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId))

    expect(cats).toHaveLength(17)
  })
})
