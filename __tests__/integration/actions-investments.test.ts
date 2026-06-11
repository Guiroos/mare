import { describe, it, expect, beforeAll, vi } from 'vitest'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createInvestmentType } from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))
vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsInvestmentType: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-investments-${Date.now()}`))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const { assertOwnsInvestmentType } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsInvestmentType).mockResolvedValue(undefined)
})

describe('archiveInvestmentType', () => {
  it('arquiva tipo com saldo zero', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo para Arquivar' })

    const { archiveInvestmentType } = await import('@/lib/actions/investments')
    await archiveInvestmentType(type.id)

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.archived).toBe(true)
  })

  it('lança erro ao tentar arquivar tipo com saldo positivo', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo com Saldo' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-01-01',
      amount: '1000.00',
      excludeFromCashFlow: false,
    })

    const { archiveInvestmentType } = await import('@/lib/actions/investments')
    await expect(archiveInvestmentType(type.id)).rejects.toThrow(
      'Não é possível arquivar tipo com saldo.'
    )

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.archived).toBe(false)
  })

  it('permite arquivar tipo com aportes e resgates zerados (saldo = 0)', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo Zerado' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-02-01',
      amount: '500.00',
      excludeFromCashFlow: false,
    })

    await db.insert(schema.investmentWithdrawals).values({
      userId,
      investmentTypeId: type.id,
      amount: '500.00',
      date: '2025-02-28',
      destination: 'transfer',
    })

    const { archiveInvestmentType } = await import('@/lib/actions/investments')
    await archiveInvestmentType(type.id)

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.archived).toBe(true)
  })

  it('permite arquivar quando resgate com taxAmount zera o saldo bruto', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo Zerado com IR' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-03-01',
      amount: '500.00',
      excludeFromCashFlow: false,
    })

    // líquido R$450 + IR R$50 = bruto R$500 → saldo = 500 - 500 = 0
    await db.insert(schema.investmentWithdrawals).values({
      userId,
      investmentTypeId: type.id,
      amount: '450.00',
      taxAmount: '50.00',
      date: '2025-03-31',
      destination: 'transfer',
    })

    const { archiveInvestmentType } = await import('@/lib/actions/investments')
    await archiveInvestmentType(type.id)

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.archived).toBe(true)
  })

  it('lança erro ao arquivar quando saldo residual existe após contabilizar taxAmount', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo com Saldo Residual' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-04-01',
      amount: '500.00',
      excludeFromCashFlow: false,
    })

    // líquido R$400 + IR R$50 = bruto R$450 → saldo = 500 - 450 = R$50
    await db.insert(schema.investmentWithdrawals).values({
      userId,
      investmentTypeId: type.id,
      amount: '400.00',
      taxAmount: '50.00',
      date: '2025-04-30',
      destination: 'transfer',
    })

    const { archiveInvestmentType } = await import('@/lib/actions/investments')
    await expect(archiveInvestmentType(type.id)).rejects.toThrow(
      'Não é possível arquivar tipo com saldo.'
    )
  })
})

describe('restoreInvestmentType', () => {
  it('restaura tipo arquivado', async () => {
    const type = await createInvestmentType(db, userId, {
      name: 'Tipo Arquivado para Restaurar',
      archived: true,
    })

    const { restoreInvestmentType } = await import('@/lib/actions/investments')
    await restoreInvestmentType(type.id)

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.archived).toBe(false)
  })

  it('verifica ownership antes de restaurar', async () => {
    const { assertOwnsInvestmentType } = await import('@/lib/auth/ownership')
    const type = await createInvestmentType(db, userId, {
      name: 'Tipo para checar ownership',
      archived: true,
    })

    vi.mocked(assertOwnsInvestmentType).mockRejectedValueOnce(new Error('Forbidden'))

    const { restoreInvestmentType } = await import('@/lib/actions/investments')
    await expect(restoreInvestmentType(type.id)).rejects.toThrow('Forbidden')
  })
})

describe('createWithdrawal', () => {
  it('income criado inclui nome do tipo no source', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB Banco Inter' })

    const { createWithdrawal } = await import('@/lib/actions/investments')
    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB Banco Inter',
      amount: '1000.00',
      date: '2025-06-01',
      destination: 'income',
    })

    const income = await db.query.incomes.findFirst({
      where: and(eq(schema.incomes.userId, userId), eq(schema.incomes.amount, '1000.00')),
    })

    expect(income?.source).toBe('Resgate investimento CDB Banco Inter')
  })

  it('destination=transfer não cria income', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB sem Income' })

    const { createWithdrawal } = await import('@/lib/actions/investments')
    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB sem Income',
      amount: '500.00',
      date: '2025-06-02',
      destination: 'transfer',
    })

    const withdrawals = await db.query.investmentWithdrawals.findMany({
      where: and(
        eq(schema.investmentWithdrawals.userId, userId),
        eq(schema.investmentWithdrawals.investmentTypeId, type.id)
      ),
    })

    expect(withdrawals).toHaveLength(1)
    expect(withdrawals[0].incomeId).toBeNull()
  })

  it('destination=reinvest cria income com investmentReturnCapital = min(resgate, capital)', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB Reinvest' })

    await db.insert(schema.investments).values([
      {
        userId,
        investmentTypeId: type.id,
        referenceMonth: '2025-01-01',
        amount: '2000.00',
        yieldAmount: null,
        excludeFromCashFlow: false,
      },
      {
        userId,
        investmentTypeId: type.id,
        referenceMonth: '2025-02-01',
        amount: '1000.00',
        yieldAmount: null,
        excludeFromCashFlow: false,
      },
    ])

    const { createWithdrawal } = await import('@/lib/actions/investments')
    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB Reinvest',
      amount: '3450.00',
      date: '2025-06-01',
      destination: 'reinvest',
    })

    const income = await db.query.incomes.findFirst({
      where: and(eq(schema.incomes.userId, userId), eq(schema.incomes.amount, '3450.00')),
    })

    expect(income).toBeDefined()
    expect(income?.investmentReturnCapital).toBe('3000.00')
  })

  it('destination=reinvest com resgate menor que capital usa o valor do resgate', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB Parcial' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-01-01',
      amount: '3000.00',
      yieldAmount: null,
      excludeFromCashFlow: false,
    })

    const { createWithdrawal } = await import('@/lib/actions/investments')
    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB Parcial',
      amount: '50.00',
      date: '2025-06-01',
      destination: 'reinvest',
    })

    const income = await db.query.incomes.findFirst({
      where: and(eq(schema.incomes.userId, userId), eq(schema.incomes.amount, '50.00')),
    })

    expect(income?.investmentReturnCapital).toBe('50.00')
  })

  it('destination=income NÃO seta investmentReturnCapital (emergência)', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB Emergencia' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-01-01',
      amount: '3000.00',
      yieldAmount: null,
      excludeFromCashFlow: false,
    })

    const { createWithdrawal } = await import('@/lib/actions/investments')
    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB Emergencia',
      amount: '75.00',
      date: '2025-06-02',
      destination: 'income',
    })

    const withdrawal = await db.query.investmentWithdrawals.findFirst({
      where: and(
        eq(schema.investmentWithdrawals.userId, userId),
        eq(schema.investmentWithdrawals.investmentTypeId, type.id)
      ),
    })

    const income = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, withdrawal!.incomeId!),
    })

    expect(income?.investmentReturnCapital).toBeNull()
  })
})

describe('updateWithdrawal', () => {
  it('destination=reinvest recalcula investmentReturnCapital ao editar amount', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB Update' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-01-01',
      amount: '3000.00',
      yieldAmount: null,
      excludeFromCashFlow: false,
    })

    const { createWithdrawal, updateWithdrawal } = await import('@/lib/actions/investments')

    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB Update',
      amount: '3450.00',
      date: '2025-06-01',
      destination: 'reinvest',
    })

    const withdrawal = await db.query.investmentWithdrawals.findFirst({
      where: and(
        eq(schema.investmentWithdrawals.userId, userId),
        eq(schema.investmentWithdrawals.investmentTypeId, type.id)
      ),
    })
    expect(withdrawal).toBeDefined()

    await updateWithdrawal({
      id: withdrawal!.id,
      investmentTypeId: type.id,
      amount: '200.00',
      date: '2025-06-01',
    })

    const income = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, withdrawal!.incomeId!),
    })

    // min(200, 3000) = 200
    expect(income?.amount).toBe('200.00')
    expect(income?.investmentReturnCapital).toBe('200.00')
  })
})
