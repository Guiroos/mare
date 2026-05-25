import { describe, it, expect, beforeAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createCategoryGroup, createCategory } from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let categoryId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `budgets-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id, {
    name: 'Alimentação',
    defaultBudget: '500.00',
  }))
})

async function upsertOverride(referenceMonth: string, amount: string) {
  await db
    .insert(schema.monthlyBudgetOverrides)
    .values({ userId, categoryId, referenceMonth, amount })
    .onConflictDoUpdate({
      target: [
        schema.monthlyBudgetOverrides.userId,
        schema.monthlyBudgetOverrides.categoryId,
        schema.monthlyBudgetOverrides.referenceMonth,
      ],
      set: { amount },
    })
}

async function getOverride(referenceMonth: string) {
  return db
    .select()
    .from(schema.monthlyBudgetOverrides)
    .where(
      and(
        eq(schema.monthlyBudgetOverrides.userId, userId),
        eq(schema.monthlyBudgetOverrides.categoryId, categoryId),
        eq(schema.monthlyBudgetOverrides.referenceMonth, referenceMonth)
      )
    )
}

describe('monthlyBudgetOverrides — upsert via onConflictDoUpdate', () => {
  it('primeira inserção cria exatamente uma row', async () => {
    await upsertOverride('2025-08-01', '800.00')

    const rows = await getOverride('2025-08-01')

    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe('800.00')
  })

  it('segunda inserção com mesma chave atualiza o valor sem duplicar', async () => {
    await upsertOverride('2025-09-01', '600.00')
    await upsertOverride('2025-09-01', '750.00')

    const rows = await getOverride('2025-09-01')

    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe('750.00')
  })

  it('meses diferentes criam rows independentes', async () => {
    const months = ['2025-10-01', '2025-11-01', '2025-12-01']

    for (const month of months) {
      await upsertOverride(month, '500.00')
    }

    const allRows = await db
      .select({ referenceMonth: schema.monthlyBudgetOverrides.referenceMonth })
      .from(schema.monthlyBudgetOverrides)
      .where(
        and(
          eq(schema.monthlyBudgetOverrides.userId, userId),
          eq(schema.monthlyBudgetOverrides.categoryId, categoryId)
        )
      )

    const insertedMonths = allRows.map((r) => r.referenceMonth)
    for (const m of months) {
      expect(insertedMonths).toContain(m)
    }
  })

  it('inserção sem onConflictDoUpdate lança erro com chave duplicada', async () => {
    await upsertOverride('2026-01-01', '400.00')

    await expect(
      db.insert(schema.monthlyBudgetOverrides).values({
        userId,
        categoryId,
        referenceMonth: '2026-01-01',
        amount: '999.00',
      })
    ).rejects.toThrow()
  })
})
