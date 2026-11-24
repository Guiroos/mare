import { vi, describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createIncome, createInvestmentType } from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsInvestmentType: vi.fn(),
  assertOwnsPerson: vi.fn(),
  assertOwnsDebtEntry: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let personId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-incomes-${Date.now()}`))
  ;({ id: personId } = await createPerson(db, userId))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const ownership = await import('@/lib/auth/ownership')
  vi.mocked(ownership.assertOwnsInvestmentType).mockResolvedValue(undefined)
  vi.mocked(ownership.assertOwnsPerson).mockResolvedValue(undefined)
  vi.mocked(ownership.assertOwnsDebtEntry).mockResolvedValue(undefined)
})

describe('deleteIncome', () => {
  it('entrada avulsa (sem vínculo) é excluída', async () => {
    const income = await createIncome(db, userId)

    const { deleteIncome } = await import('@/lib/actions/incomes')
    const result = await deleteIncome(income.id)

    expect(result).toEqual({ ok: true, data: undefined })
    const saved = await db.query.incomes.findFirst({ where: eq(schema.incomes.id, income.id) })
    expect(saved).toBeUndefined()
  })

  it('recusa entrada criada por resgate e mantém o vínculo do resgate', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tesouro delete income' })
    const { createWithdrawal } = await import('@/lib/actions/investments')
    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'Tesouro delete income',
      amount: '1000.00',
      date: '2025-06-01',
      destination: 'income',
    })
    const withdrawal = await db.query.investmentWithdrawals.findFirst({
      where: eq(schema.investmentWithdrawals.investmentTypeId, type.id),
    })
    const incomeId = withdrawal!.incomeId!

    const { deleteIncome } = await import('@/lib/actions/incomes')
    const result = await deleteIncome(incomeId)

    expect(result).toMatchObject({ ok: false, code: 'income_owned_by_withdrawal' })
    const income = await db.query.incomes.findFirst({ where: eq(schema.incomes.id, incomeId) })
    expect(income).toBeDefined()
    const after = await db.query.investmentWithdrawals.findFirst({
      where: eq(schema.investmentWithdrawals.id, withdrawal!.id),
    })
    expect(after?.incomeId).toBe(incomeId)
  })

  it('recusa entrada criada por pagamento de devedor e mantém o vínculo', async () => {
    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await createDebtPayment({
      personId,
      amount: '200.00',
      description: 'Pagamento delete income',
      entryDate: '2025-08-15',
      createIncome: true,
      referenceMonth: '2025-08-01',
    })
    const payment = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.userId, userId),
    })
    const incomeId = payment!.incomeId!

    const { deleteIncome } = await import('@/lib/actions/incomes')
    const result = await deleteIncome(incomeId)

    expect(result).toMatchObject({ ok: false, code: 'income_owned_by_debt_payment' })
    const income = await db.query.incomes.findFirst({ where: eq(schema.incomes.id, incomeId) })
    expect(income).toBeDefined()
    const after = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, payment!.id),
    })
    expect(after?.incomeId).toBe(incomeId)
  })

  it('id não-UUID devolve not_found em vez de estourar no Postgres', async () => {
    const { deleteIncome } = await import('@/lib/actions/incomes')
    const result = await deleteIncome('nao-e-uuid')
    expect(result).toMatchObject({ ok: false, code: 'not_found' })
  })
})
