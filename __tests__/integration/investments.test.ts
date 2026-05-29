import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createInvestmentType, createGoal, createIncome } from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let investmentTypeId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `investments-${Date.now()}`))
  ;({ id: investmentTypeId } = await createInvestmentType(db, userId))
})

describe('upsertInvestment', () => {
  it('cria registro quando não existe para o mês', async () => {
    const [row] = await db
      .insert(schema.investments)
      .values({
        userId,
        investmentTypeId,
        referenceMonth: '2025-01-01',
        amount: '500.00',
        excludeFromCashFlow: false,
      })
      .returning()

    expect(row.amount).toBe('500.00')
    expect(row.referenceMonth).toBe('2025-01-01')
  })

  it('atualiza sem criar duplicata quando já existe para o mesmo mês', async () => {
    const month = '2025-02-01'

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId,
      referenceMonth: month,
      amount: '1000.00',
      excludeFromCashFlow: false,
    })

    await db
      .insert(schema.investments)
      .values({
        userId,
        investmentTypeId,
        referenceMonth: month,
        amount: '1500.00',
        excludeFromCashFlow: false,
      })
      .onConflictDoUpdate({
        target: [
          schema.investments.userId,
          schema.investments.investmentTypeId,
          schema.investments.referenceMonth,
        ],
        set: { amount: '1500.00' },
      })

    const rows = await db.query.investments.findMany({
      where: (t, { and, eq }) =>
        and(
          eq(t.userId, userId),
          eq(t.investmentTypeId, investmentTypeId),
          eq(t.referenceMonth, month)
        ),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe('1500.00')
  })

  it('insert sem onConflictDoUpdate lança erro de unique constraint', async () => {
    const month = '2025-03-01'

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId,
      referenceMonth: month,
      amount: '200.00',
      excludeFromCashFlow: false,
    })

    await expect(
      db.insert(schema.investments).values({
        userId,
        investmentTypeId,
        referenceMonth: month,
        amount: '300.00',
        excludeFromCashFlow: false,
      })
    ).rejects.toThrow()
  })

  it('meses diferentes criam rows independentes', async () => {
    const typeForMonths = await createInvestmentType(db, userId, { name: 'Tipo Meses' })

    await db.insert(schema.investments).values([
      {
        userId,
        investmentTypeId: typeForMonths.id,
        referenceMonth: '2025-04-01',
        amount: '400.00',
        excludeFromCashFlow: false,
      },
      {
        userId,
        investmentTypeId: typeForMonths.id,
        referenceMonth: '2025-05-01',
        amount: '450.00',
        excludeFromCashFlow: false,
      },
    ])

    const rows = await db.query.investments.findMany({
      where: (t, { and, eq }) =>
        and(eq(t.userId, userId), eq(t.investmentTypeId, typeForMonths.id)),
    })

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.referenceMonth).sort()).toEqual(['2025-04-01', '2025-05-01'])
  })
})

describe('createWithdrawal', () => {
  it('destination=income cria withdrawal e income atomicamente', async () => {
    let withdrawalId: string
    let incomeId: string

    await db.transaction(async (tx) => {
      const [income] = await tx
        .insert(schema.incomes)
        .values({
          userId,
          source: 'Resgate de investimento',
          amount: '800.00',
          referenceMonth: '2025-06-01',
        })
        .returning({ id: schema.incomes.id })
      incomeId = income.id

      const [withdrawal] = await tx
        .insert(schema.investmentWithdrawals)
        .values({
          userId,
          investmentTypeId,
          amount: '800.00',
          date: '2025-06-15',
          destination: 'income',
          incomeId,
        })
        .returning({
          id: schema.investmentWithdrawals.id,
          incomeId: schema.investmentWithdrawals.incomeId,
        })
      withdrawalId = withdrawal.id

      expect(withdrawal.incomeId).toBe(incomeId)
    })

    const savedWithdrawal = await db.query.investmentWithdrawals.findFirst({
      where: eq(schema.investmentWithdrawals.id, withdrawalId!),
    })
    const savedIncome = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, incomeId!),
    })

    expect(savedWithdrawal?.incomeId).toBe(incomeId!)
    expect(savedIncome?.amount).toBe('800.00')
  })

  it('destination=transfer cria withdrawal sem income (incomeId null)', async () => {
    const [withdrawal] = await db
      .insert(schema.investmentWithdrawals)
      .values({
        userId,
        investmentTypeId,
        amount: '200.00',
        date: '2025-07-01',
        destination: 'transfer',
      })
      .returning({
        id: schema.investmentWithdrawals.id,
        incomeId: schema.investmentWithdrawals.incomeId,
      })

    expect(withdrawal.incomeId).toBeNull()
  })
})

describe('investmentWithdrawals.incomeId — ON DELETE SET NULL', () => {
  it('deletar o income vinculado nulifica incomeId no withdrawal sem deletar a row', async () => {
    const income = await createIncome(db, userId, {
      referenceMonth: '2025-08-01',
      amount: '300.00',
    })

    const [withdrawal] = await db
      .insert(schema.investmentWithdrawals)
      .values({
        userId,
        investmentTypeId,
        amount: '300.00',
        date: '2025-08-10',
        destination: 'income',
        incomeId: income.id,
      })
      .returning({ id: schema.investmentWithdrawals.id })

    await db.delete(schema.incomes).where(eq(schema.incomes.id, income.id))

    const afterDelete = await db.query.investmentWithdrawals.findFirst({
      where: eq(schema.investmentWithdrawals.id, withdrawal.id),
    })

    expect(afterDelete).toBeDefined()
    expect(afterDelete?.incomeId).toBeNull()
  })
})

describe('investmentTypes.goalId — ON DELETE SET NULL', () => {
  it('deletar o goal nulifica goalId em investmentTypes sem deletar o tipo', async () => {
    const goal = await createGoal(db, userId)
    const type = await createInvestmentType(db, userId, { name: 'Tipo com Meta', goalId: goal.id })

    const before = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })
    expect(before?.goalId).toBe(goal.id)

    await db.delete(schema.goals).where(eq(schema.goals.id, goal.id))

    const after = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(after).toBeDefined()
    expect(after?.goalId).toBeNull()
  })
})

describe('investmentTypes.id — ON DELETE RESTRICT', () => {
  it('deletar tipo com aportes vinculados lança erro de FK', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo com Aporte' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-09-01',
      amount: '100.00',
      excludeFromCashFlow: false,
    })

    await expect(
      db.delete(schema.investmentTypes).where(eq(schema.investmentTypes.id, type.id))
    ).rejects.toThrow()
  })

  it('deletar tipo com resgates vinculados lança erro de FK', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo com Resgate' })

    await db.insert(schema.investmentWithdrawals).values({
      userId,
      investmentTypeId: type.id,
      amount: '50.00',
      date: '2025-09-15',
      destination: 'transfer',
    })

    await expect(
      db.delete(schema.investmentTypes).where(eq(schema.investmentTypes.id, type.id))
    ).rejects.toThrow()
  })
})

describe('investmentTypes.maturityDate', () => {
  it('persiste maturityDate quando fornecido', async () => {
    const type = await createInvestmentType(db, userId, {
      name: 'CDB com Vencimento',
      maturityDate: '2027-06-30',
    })

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.maturityDate).toBe('2027-06-30')
  })

  it('maturityDate é null por padrão', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Sem Vencimento' })

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.maturityDate).toBeNull()
  })

  it('archived é false por padrão', async () => {
    const type = await createInvestmentType(db, userId, { name: 'Tipo Padrão' })

    const saved = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })

    expect(saved?.archived).toBe(false)
  })
})

describe('investmentWithdrawals.taxAmount', () => {
  it('persiste taxAmount quando fornecido', async () => {
    const [withdrawal] = await db
      .insert(schema.investmentWithdrawals)
      .values({
        userId,
        investmentTypeId,
        amount: '4800.00',
        taxAmount: '200.00',
        date: '2025-10-01',
        destination: 'transfer',
      })
      .returning()

    expect(withdrawal.amount).toBe('4800.00')
    expect(withdrawal.taxAmount).toBe('200.00')
  })

  it('taxAmount é null por padrão', async () => {
    const [withdrawal] = await db
      .insert(schema.investmentWithdrawals)
      .values({
        userId,
        investmentTypeId,
        amount: '1000.00',
        date: '2025-10-15',
        destination: 'transfer',
      })
      .returning()

    expect(withdrawal.taxAmount).toBeNull()
  })
})
