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

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

// `cookies()` lança fora de um request scope — a action a usa para derrubar o
// cookie de sessão JWT no servidor após o DELETE.
const deletedCookies: string[] = []
vi.mock('next/headers', () => ({
  cookies: async () => ({ delete: (name: string) => deletedCookies.push(name) }),
}))

neonTestingSetup()

let db: TestDb

beforeAll(async () => {
  db = createTestDb()
})

/**
 * Popula uma conta com pelo menos uma linha em cada tabela que referencia
 * `users.id`. É o que dá valor ao teste de cascade: uma tabela nova cujo FK
 * esqueça o `onDelete: 'cascade'` faz o DELETE estourar violação de FK aqui,
 * em vez de passar silenciosamente.
 */
async function seedFullAccount(suffix: string) {
  const { id: userId, email } = await createUser(db, suffix)

  const group = await createCategoryGroup(db, userId)
  const category = await createCategory(db, userId, group.id)
  const account = await createAccount(db, userId)

  await createTransaction(db, userId, account.id, { categoryId: category.id })
  await createFixedExpense(db, userId, account.id, category.id)
  const income = await createIncome(db, userId)
  await createInstallmentGroup(db, userId, account.id, category.id)

  const goal = await createGoal(db, userId)
  const investType = await createInvestmentType(db, userId)
  await db.insert(schema.investments).values({
    userId,
    investmentTypeId: investType.id,
    amount: '500.00',
    referenceMonth: '2025-01-01',
  })
  await db.insert(schema.investmentWithdrawals).values({
    userId,
    investmentTypeId: investType.id,
    incomeId: income.id,
    amount: '100.00',
    destination: 'income',
    date: '2025-02-10',
  })
  await createGoalContribution(db, userId, goal.id)

  const person = await createPerson(db, userId)
  await createCharge(db, userId, person.id)

  await db.insert(schema.monthlyBudgetOverrides).values({
    userId,
    categoryId: category.id,
    referenceMonth: '2025-01-01',
    amount: '100.00',
  })
  await db.insert(schema.userSettings).values({
    userId,
    creditMode: 'accrual',
    faturaActiveFrom: null,
  })
  await db.insert(schema.feedback).values({
    userId,
    category: 'outros',
    message: 'mensagem de teste',
  })
  await db.insert(schema.accounts).values({
    userId,
    type: 'oauth',
    provider: 'google',
    providerAccountId: `google-${suffix}`,
  })
  await db.insert(schema.sessions).values({
    userId,
    sessionToken: `token-${suffix}`,
    expires: new Date(Date.now() + 86_400_000),
  })

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  return { userId, email }
}

/** Conta quantas linhas sobraram para o usuário em cada tabela escopada. */
async function countRemaining(userId: string) {
  const [
    users,
    userSettings,
    authAccounts,
    sessions,
    categoryGroups,
    categories,
    monthlyBudgetOverrides,
    paymentAccounts,
    fixedExpenses,
    installmentGroups,
    transactions,
    incomes,
    goals,
    investmentTypes,
    investments,
    investmentWithdrawals,
    goalContributions,
    people,
    debtorEntries,
    feedback,
  ] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.id, userId)),
    db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)),
    db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)),
    db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId)),
    db.select().from(schema.categoryGroups).where(eq(schema.categoryGroups.userId, userId)),
    db.select().from(schema.categories).where(eq(schema.categories.userId, userId)),
    db
      .select()
      .from(schema.monthlyBudgetOverrides)
      .where(eq(schema.monthlyBudgetOverrides.userId, userId)),
    db.select().from(schema.paymentAccounts).where(eq(schema.paymentAccounts.userId, userId)),
    db.select().from(schema.fixedExpenses).where(eq(schema.fixedExpenses.userId, userId)),
    db.select().from(schema.installmentGroups).where(eq(schema.installmentGroups.userId, userId)),
    db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId)),
    db.select().from(schema.incomes).where(eq(schema.incomes.userId, userId)),
    db.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
    db.select().from(schema.investmentTypes).where(eq(schema.investmentTypes.userId, userId)),
    db.select().from(schema.investments).where(eq(schema.investments.userId, userId)),
    db
      .select()
      .from(schema.investmentWithdrawals)
      .where(eq(schema.investmentWithdrawals.userId, userId)),
    db.select().from(schema.goalContributions).where(eq(schema.goalContributions.userId, userId)),
    db.select().from(schema.people).where(eq(schema.people.userId, userId)),
    db.select().from(schema.debtorEntries).where(eq(schema.debtorEntries.userId, userId)),
    db.select().from(schema.feedback).where(eq(schema.feedback.userId, userId)),
  ])

  return {
    users: users.length,
    userSettings: userSettings.length,
    authAccounts: authAccounts.length,
    sessions: sessions.length,
    categoryGroups: categoryGroups.length,
    categories: categories.length,
    monthlyBudgetOverrides: monthlyBudgetOverrides.length,
    paymentAccounts: paymentAccounts.length,
    fixedExpenses: fixedExpenses.length,
    installmentGroups: installmentGroups.length,
    transactions: transactions.length,
    incomes: incomes.length,
    goals: goals.length,
    investmentTypes: investmentTypes.length,
    investments: investments.length,
    investmentWithdrawals: investmentWithdrawals.length,
    goalContributions: goalContributions.length,
    people: people.length,
    debtorEntries: debtorEntries.length,
    feedback: feedback.length,
  }
}

describe('deleteAccount', () => {
  it('apaga o usuário e todas as linhas escopadas a ele', async () => {
    const { userId, email } = await seedFullAccount(`delete-account-${Date.now()}`)

    // Sanidade: o seed precisa ter populado tudo, senão o teste de cascade
    // passaria contando zeros que já eram zero antes do DELETE.
    const before = await countRemaining(userId)
    for (const [table, count] of Object.entries(before)) {
      expect(count, `seed deveria ter populado ${table}`).toBeGreaterThan(0)
    }

    const { deleteAccount } = await import('@/lib/actions/delete-account')
    deletedCookies.length = 0
    const result = await deleteAccount(email)

    expect(result).toEqual({ ok: true })

    // A sessão é JWT: sem derrubar o cookie no servidor o usuário continuaria
    // autenticado numa conta que não existe mais até o maxAge de 24h.
    expect(deletedCookies).toContain('next-auth.session-token')
    expect(deletedCookies).toContain('__Secure-next-auth.session-token')

    const after = await countRemaining(userId)
    for (const [table, count] of Object.entries(after)) {
      expect(count, `${table} deveria estar vazia após a exclusão`).toBe(0)
    }
  })

  it('aceita o e-mail com espaços e caixa diferente', async () => {
    const { userId, email } = await seedFullAccount(`delete-case-${Date.now()}`)

    const { deleteAccount } = await import('@/lib/actions/delete-account')
    const result = await deleteAccount(`  ${email.toUpperCase()}  `)

    expect(result).toEqual({ ok: true })
    expect((await countRemaining(userId)).users).toBe(0)
  })

  it('não apaga nada quando o e-mail de confirmação não bate', async () => {
    const { userId } = await seedFullAccount(`delete-mismatch-${Date.now()}`)

    const { deleteAccount } = await import('@/lib/actions/delete-account')
    const result = await deleteAccount('outro@test.com')

    expect(result).toEqual({ ok: false, error: 'E-mail de confirmação não confere.' })

    const after = await countRemaining(userId)
    expect(after.users).toBe(1)
    expect(after.transactions).toBe(1)
    expect(after.authAccounts).toBe(1)
  })

  it('não apaga nada quando a confirmação vem vazia', async () => {
    const { userId } = await seedFullAccount(`delete-empty-${Date.now()}`)

    const { deleteAccount } = await import('@/lib/actions/delete-account')
    const result = await deleteAccount('   ')

    expect(result).toEqual({ ok: false, error: 'E-mail de confirmação não confere.' })
    expect((await countRemaining(userId)).users).toBe(1)
  })

  // Server Action é endpoint HTTP: o argumento chega do cliente sem passar pelo
  // TypeScript. Sem o parse, `.trim()` sobre `null` viraria um 500 opaco em vez
  // do retorno tipado.
  it('rejeita confirmação que não é string em vez de estourar', async () => {
    const { userId } = await seedFullAccount(`delete-nonstring-${Date.now()}`)

    const { deleteAccount } = await import('@/lib/actions/delete-account')
    const result = await deleteAccount(null as unknown as string)

    expect(result).toEqual({ ok: false, error: 'E-mail de confirmação não confere.' })
    expect((await countRemaining(userId)).users).toBe(1)
  })

  it('não toca nos dados de outro usuário', async () => {
    const { id: otherUserId } = await createUser(db, `delete-other-${Date.now()}`)
    const otherGroup = await createCategoryGroup(db, otherUserId, 'Grupo Outro')
    await createCategory(db, otherUserId, otherGroup.id, { name: 'Cat Outro' })

    const { email } = await seedFullAccount(`delete-isolation-${Date.now()}`)

    const { deleteAccount } = await import('@/lib/actions/delete-account')
    await deleteAccount(email)

    const otherRemaining = await countRemaining(otherUserId)
    expect(otherRemaining.users).toBe(1)
    expect(otherRemaining.categories).toBe(1)
  })
})
