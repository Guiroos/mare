import * as schema from '@/lib/db/schema'
import type { TestDb } from './db'

export async function createUser(db: TestDb, suffix: string | number = Date.now()) {
  const [user] = await db
    .insert(schema.users)
    .values({ name: 'Test User', email: `test-${suffix}@test.com` })
    .returning({ id: schema.users.id })
  return user
}

export async function createPerson(db: TestDb, userId: string, name = 'Pessoa Teste') {
  const [person] = await db
    .insert(schema.people)
    .values({ userId, name })
    .returning({ id: schema.people.id })
  return person
}

export async function createCategoryGroup(db: TestDb, userId: string, name = 'Grupo Teste') {
  const [group] = await db
    .insert(schema.categoryGroups)
    .values({ userId, name })
    .returning({ id: schema.categoryGroups.id })
  return group
}

export async function createCategory(
  db: TestDb,
  userId: string,
  groupId: string,
  overrides: Partial<typeof schema.categories.$inferInsert> = {}
) {
  const [category] = await db
    .insert(schema.categories)
    .values({ userId, groupId, name: 'Categoria Teste', ...overrides })
    .returning({ id: schema.categories.id })
  return category
}

export async function createAccount(
  db: TestDb,
  userId: string,
  overrides: Partial<typeof schema.paymentAccounts.$inferInsert> = {}
) {
  const [account] = await db
    .insert(schema.paymentAccounts)
    .values({ userId, name: 'Conta Teste', type: 'debit', ...overrides })
    .returning({ id: schema.paymentAccounts.id })
  return account
}

export async function createCharge(
  db: TestDb,
  userId: string,
  personId: string,
  overrides: Partial<typeof schema.debtorEntries.$inferInsert> = {}
) {
  const [entry] = await db
    .insert(schema.debtorEntries)
    .values({
      userId,
      personId,
      type: 'charge',
      status: 'open',
      amount: '100.00',
      description: 'Cobrança teste',
      entryDate: '2025-01-10',
      referenceMonth: '2025-01-01',
      ...overrides,
    })
    .returning({ id: schema.debtorEntries.id, amount: schema.debtorEntries.amount })
  return entry
}

export async function createInvestmentType(
  db: TestDb,
  userId: string,
  overrides: Partial<typeof schema.investmentTypes.$inferInsert> = {}
) {
  const [type] = await db
    .insert(schema.investmentTypes)
    .values({ userId, name: 'Tipo Teste', color: '#6366f1', bgColor: '#e0e7ff', ...overrides })
    .returning({ id: schema.investmentTypes.id })
  return type
}

export async function createGoal(
  db: TestDb,
  userId: string,
  overrides: Partial<typeof schema.goals.$inferInsert> = {}
) {
  const [goal] = await db
    .insert(schema.goals)
    .values({ userId, name: 'Meta Teste', targetAmount: '10000.00', ...overrides })
    .returning({ id: schema.goals.id })
  return goal
}

export async function createIncome(
  db: TestDb,
  userId: string,
  overrides: Partial<typeof schema.incomes.$inferInsert> = {}
) {
  const [income] = await db
    .insert(schema.incomes)
    .values({
      userId,
      source: 'Renda Teste',
      amount: '1000.00',
      referenceMonth: '2025-01-01',
      ...overrides,
    })
    .returning({ id: schema.incomes.id })
  return income
}

export async function createPayment(
  db: TestDb,
  userId: string,
  personId: string,
  overrides: Partial<typeof schema.debtorEntries.$inferInsert> = {}
) {
  const [entry] = await db
    .insert(schema.debtorEntries)
    .values({
      userId,
      personId,
      type: 'payment',
      amount: '100.00',
      description: 'Pagamento teste',
      entryDate: '2025-01-15',
      referenceMonth: '2025-01-01',
      ...overrides,
    })
    .returning({ id: schema.debtorEntries.id })
  return entry
}

export async function createAdjustment(
  db: TestDb,
  userId: string,
  personId: string,
  overrides: Partial<typeof schema.debtorEntries.$inferInsert> = {}
) {
  const [entry] = await db
    .insert(schema.debtorEntries)
    .values({
      userId,
      personId,
      type: 'adjustment',
      amount: '-100.00',
      description: 'Ajuste teste',
      entryDate: '2025-01-20',
      referenceMonth: '2025-01-01',
      status: null,
      ...overrides,
    })
    .returning({ id: schema.debtorEntries.id })
  return entry
}

export async function createGoalContribution(
  db: TestDb,
  userId: string,
  goalId: string,
  overrides: Partial<typeof schema.goalContributions.$inferInsert> = {}
) {
  const [contribution] = await db
    .insert(schema.goalContributions)
    .values({
      userId,
      goalId,
      amount: '500.00',
      referenceMonth: '2025-01-01',
      source: 'manual',
      ...overrides,
    })
    .returning({ id: schema.goalContributions.id })
  return contribution
}

export async function createInstallmentGroup(
  db: TestDb,
  userId: string,
  accountId: string,
  categoryId: string,
  overrides: Partial<typeof schema.installmentGroups.$inferInsert> = {}
) {
  const [group] = await db
    .insert(schema.installmentGroups)
    .values({
      userId,
      accountId,
      categoryId,
      name: 'Parcelamento Teste',
      totalAmount: '300.00',
      totalInstallments: 3,
      startDate: '2025-01-01',
      ...overrides,
    })
    .returning({ id: schema.installmentGroups.id })
  return group
}

export async function createTransaction(
  db: TestDb,
  userId: string,
  accountId: string,
  overrides: Partial<typeof schema.transactions.$inferInsert> = {}
) {
  const [tx] = await db
    .insert(schema.transactions)
    .values({
      userId,
      accountId,
      name: 'Transação Teste',
      amount: '50.00',
      date: '2025-01-10',
      referenceMonth: '2025-01-01',
      ...overrides,
    })
    .returning({ id: schema.transactions.id })
  return tx
}

export async function createFixedExpense(
  db: TestDb,
  userId: string,
  accountId: string,
  categoryId: string,
  overrides: Partial<typeof schema.fixedExpenses.$inferInsert> = {}
) {
  const [fe] = await db
    .insert(schema.fixedExpenses)
    .values({
      userId,
      accountId,
      categoryId,
      name: 'Gasto Fixo Teste',
      amount: '200.00',
      dueDay: 10,
      paid: false,
      referenceMonth: '2025-01-01',
      ...overrides,
    })
    .returning({ id: schema.fixedExpenses.id })
  return fe
}
