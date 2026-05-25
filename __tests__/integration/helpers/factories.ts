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
