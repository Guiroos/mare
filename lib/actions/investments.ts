'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { investmentTypes, investments, investmentWithdrawals, incomes } from '@/lib/db/schema'
import { eq, and, sum, sql } from 'drizzle-orm'
import { dateToReferenceMonth } from '@/lib/utils/date'
import { DEFAULT_INVESTMENT_TYPE_COLOR, deriveBgColor } from '@/lib/utils/color'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsInvestmentType } from '@/lib/auth/ownership'
import {
  investmentTypeSchema,
  upsertInvestmentActionSchema,
  withdrawalSchema,
  updateWithdrawalActionSchema,
} from '@/lib/validations/investments'

// ─── Tipos de investimento ────────────────────────────────────────────────────

export type InvestmentTypeInput = {
  name: string
  color?: string
  maturityDate?: string | null
}

export async function createInvestmentType(data: InvestmentTypeInput) {
  const userId = await requireUserId()
  investmentTypeSchema.parse(data)
  const color = data.color || DEFAULT_INVESTMENT_TYPE_COLOR

  await db.insert(investmentTypes).values({
    userId,
    name: data.name,
    color,
    bgColor: deriveBgColor(color),
    maturityDate: data.maturityDate || null,
  })
  revalidatePath('/investimentos')
}

export async function updateInvestmentType(id: string, data: InvestmentTypeInput) {
  const userId = await requireUserId()
  investmentTypeSchema.parse(data)
  const color = data.color || DEFAULT_INVESTMENT_TYPE_COLOR

  await db
    .update(investmentTypes)
    .set({
      name: data.name,
      color,
      bgColor: deriveBgColor(color),
      maturityDate: data.maturityDate || null,
    })
    .where(and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId)))
  revalidatePath('/investimentos')
}

export async function deleteInvestmentType(id: string) {
  const userId = await requireUserId()
  await db
    .delete(investmentTypes)
    .where(and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId)))
  revalidatePath('/investimentos')
}

export async function archiveInvestmentType(id: string) {
  const userId = await requireUserId()
  await assertOwnsInvestmentType(userId, id)

  const [amountResult, withdrawalResult] = await Promise.all([
    db
      .select({ totalAmount: sum(investments.amount), totalYield: sum(investments.yieldAmount) })
      .from(investments)
      .where(and(eq(investments.userId, userId), eq(investments.investmentTypeId, id))),
    db
      .select({
        totalWithdrawn: sql<string>`coalesce(sum(${investmentWithdrawals.amount} + coalesce(${investmentWithdrawals.taxAmount}, 0)), 0)`,
      })
      .from(investmentWithdrawals)
      .where(
        and(
          eq(investmentWithdrawals.userId, userId),
          eq(investmentWithdrawals.investmentTypeId, id)
        )
      ),
  ])

  const currentBalance =
    Number(amountResult[0]?.totalAmount ?? 0) +
    Number(amountResult[0]?.totalYield ?? 0) -
    Number(withdrawalResult[0]?.totalWithdrawn ?? 0)

  if (Math.round(currentBalance * 100) > 0) {
    throw new Error('Não é possível arquivar tipo com saldo.')
  }

  await db
    .update(investmentTypes)
    .set({ archived: true })
    .where(and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId)))
  revalidatePath('/investimentos')
}

export async function restoreInvestmentType(id: string) {
  const userId = await requireUserId()
  await assertOwnsInvestmentType(userId, id)
  await db
    .update(investmentTypes)
    .set({ archived: false })
    .where(and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId)))
  revalidatePath('/investimentos')
}

// ─── Registros mensais ────────────────────────────────────────────────────────

export type UpsertInvestmentInput = {
  investmentTypeId: string
  referenceMonth: string
  amount?: string | null
  yieldAmount?: string | null
  notes?: string | null
  excludeFromCashFlow?: boolean
}

export async function upsertInvestment(data: UpsertInvestmentInput) {
  const userId = await requireUserId()
  upsertInvestmentActionSchema.parse(data)

  await assertOwnsInvestmentType(userId, data.investmentTypeId)

  await db
    .insert(investments)
    .values({
      userId,
      investmentTypeId: data.investmentTypeId,
      referenceMonth: data.referenceMonth,
      amount: data.amount || null,
      yieldAmount: data.yieldAmount || null,
      notes: data.notes || null,
      excludeFromCashFlow: data.excludeFromCashFlow ?? false,
    })
    .onConflictDoUpdate({
      target: [investments.userId, investments.investmentTypeId, investments.referenceMonth],
      set: {
        amount: data.amount || null,
        yieldAmount: data.yieldAmount || null,
        notes: data.notes || null,
        excludeFromCashFlow: data.excludeFromCashFlow ?? false,
      },
    })

  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}

export async function deleteInvestment(id: string) {
  const userId = await requireUserId()
  await db.delete(investments).where(and(eq(investments.id, id), eq(investments.userId, userId)))
  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}

// ─── Resgates ─────────────────────────────────────────────────────────────────

export type CreateWithdrawalInput = {
  investmentTypeId: string
  investmentTypeName: string
  amount: string
  date: string
  destination: 'income' | 'reinvest' | 'transfer'
  taxAmount?: string | null
  notes?: string | null
}

export async function createWithdrawal(data: CreateWithdrawalInput) {
  const userId = await requireUserId()
  withdrawalSchema.parse(data)

  await assertOwnsInvestmentType(userId, data.investmentTypeId)

  let incomeId: string | null = null
  let investmentReturnCapital: string | null = null

  if (data.destination === 'reinvest') {
    const [capitalRow] = await db
      .select({ total: sum(investments.amount) })
      .from(investments)
      .where(
        and(eq(investments.userId, userId), eq(investments.investmentTypeId, data.investmentTypeId))
      )
    investmentReturnCapital = String(Math.min(Number(data.amount), Number(capitalRow?.total ?? 0)))
  }

  await db.transaction(async (tx) => {
    if (data.destination === 'income' || data.destination === 'reinvest') {
      const [income] = await tx
        .insert(incomes)
        .values({
          userId,
          source: `Resgate investimento ${data.investmentTypeName}`,
          amount: data.amount,
          referenceMonth: dateToReferenceMonth(data.date),
          investmentReturnCapital,
        })
        .returning({ id: incomes.id })
      incomeId = income.id
    }

    await tx.insert(investmentWithdrawals).values({
      userId,
      investmentTypeId: data.investmentTypeId,
      amount: data.amount,
      taxAmount: data.taxAmount || null,
      date: data.date,
      destination: data.destination,
      incomeId,
      notes: data.notes || null,
    })
  })

  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}

export type UpdateWithdrawalInput = {
  id: string
  investmentTypeId: string
  amount: string
  date: string
  taxAmount?: string | null
  notes?: string | null
}

export async function updateWithdrawal(data: UpdateWithdrawalInput) {
  const userId = await requireUserId()
  updateWithdrawalActionSchema.parse(data)

  // Fetch do resgate e ownership check do novo tipo em paralelo
  const [withdrawals] = await Promise.all([
    db.query.investmentWithdrawals.findMany({
      where: and(eq(investmentWithdrawals.id, data.id), eq(investmentWithdrawals.userId, userId)),
      limit: 1,
    }),
    assertOwnsInvestmentType(userId, data.investmentTypeId),
  ])

  const withdrawal = withdrawals[0]
  if (!withdrawal) throw new Error('Resgate não encontrado')

  await db.transaction(async (tx) => {
    await tx
      .update(investmentWithdrawals)
      .set({
        investmentTypeId: data.investmentTypeId,
        amount: data.amount,
        taxAmount: data.taxAmount || null,
        date: data.date,
        notes: data.notes || null,
      })
      .where(and(eq(investmentWithdrawals.id, data.id), eq(investmentWithdrawals.userId, userId)))

    if (withdrawal.incomeId) {
      if (withdrawal.destination === 'reinvest') {
        const [capitalRow] = await tx
          .select({ total: sum(investments.amount) })
          .from(investments)
          .where(
            and(
              eq(investments.userId, userId),
              eq(investments.investmentTypeId, data.investmentTypeId)
            )
          )
        const newReturnCapital = String(
          Math.min(Number(data.amount), Number(capitalRow?.total ?? 0))
        )
        await tx
          .update(incomes)
          .set({
            amount: data.amount,
            referenceMonth: dateToReferenceMonth(data.date),
            investmentReturnCapital: newReturnCapital,
          })
          .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)))
      } else {
        await tx
          .update(incomes)
          .set({
            amount: data.amount,
            referenceMonth: dateToReferenceMonth(data.date),
            investmentReturnCapital: null,
          })
          .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)))
      }
    }
  })

  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}

export async function deleteWithdrawal(id: string) {
  const userId = await requireUserId()

  const [withdrawal] = await db.query.investmentWithdrawals.findMany({
    where: and(eq(investmentWithdrawals.id, id), eq(investmentWithdrawals.userId, userId)),
    limit: 1,
  })

  if (!withdrawal) return

  await db.transaction(async (tx) => {
    await tx
      .delete(investmentWithdrawals)
      .where(and(eq(investmentWithdrawals.id, id), eq(investmentWithdrawals.userId, userId)))

    if (withdrawal.incomeId) {
      await tx
        .delete(incomes)
        .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)))
    }
  })

  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}
