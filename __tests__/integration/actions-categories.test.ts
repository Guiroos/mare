import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest'
import { and, eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createCategoryGroup, createCategory } from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let catId: string

const PREV_MONTH = '2025-03-01'
const DEST_MONTH = '2025-04-01'

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-categories-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: catId } = await createCategory(db, userId, group.id))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
})

afterEach(async () => {
  await db
    .delete(schema.monthlyBudgetOverrides)
    .where(eq(schema.monthlyBudgetOverrides.userId, userId))
})

describe('copyBudgetOverridesFromPrevMonth', () => {
  it('retorna { copied: 0 } quando mês anterior não tem overrides', async () => {
    const { copyBudgetOverridesFromPrevMonth } = await import('@/lib/actions/categories')
    const result = await copyBudgetOverridesFromPrevMonth(DEST_MONTH, PREV_MONTH)
    expect(result).toEqual({ copied: 0 })
  })

  it('usa db.transaction para garantir atomicidade do DELETE + INSERT', async () => {
    await db.insert(schema.monthlyBudgetOverrides).values({
      userId,
      categoryId: catId,
      referenceMonth: PREV_MONTH,
      amount: '100.00',
    })

    const { db: actionDb } = await import('@/lib/db')
    const transactionSpy = vi.spyOn(actionDb, 'transaction')

    const { copyBudgetOverridesFromPrevMonth } = await import('@/lib/actions/categories')
    await copyBudgetOverridesFromPrevMonth(DEST_MONTH, PREV_MONTH)

    expect(transactionSpy).toHaveBeenCalledOnce()
    transactionSpy.mockRestore()
  })

  it('substitui overrides do mês destino pelos do mês anterior', async () => {
    await db.insert(schema.monthlyBudgetOverrides).values([
      { userId, categoryId: catId, referenceMonth: PREV_MONTH, amount: '100.00' },
      { userId, categoryId: catId, referenceMonth: DEST_MONTH, amount: '50.00' },
    ])

    const { copyBudgetOverridesFromPrevMonth } = await import('@/lib/actions/categories')
    const result = await copyBudgetOverridesFromPrevMonth(DEST_MONTH, PREV_MONTH)

    expect(result).toEqual({ copied: 1 })

    const destOverrides = await db.query.monthlyBudgetOverrides.findMany({
      where: and(
        eq(schema.monthlyBudgetOverrides.userId, userId),
        eq(schema.monthlyBudgetOverrides.referenceMonth, DEST_MONTH)
      ),
    })
    expect(destOverrides).toHaveLength(1)
    expect(destOverrides[0].amount).toBe('100.00')
  })
})
