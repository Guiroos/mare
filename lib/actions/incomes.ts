'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { debtorEntries, incomes, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth/require-user'
import { createIncomeActionSchema, updateIncomeActionSchema } from '@/lib/validations/transactions'
import { uuidSchema } from '@/lib/validations/utils'
import type { ActionResult } from '@/lib/actions/types'
import { assertOwnsTrip } from '@/lib/auth/ownership'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'

export type CreateIncomeInput = {
  source: string
  amount: string
  referenceMonth: string
  tripId?: string
}

export async function createIncome(data: CreateIncomeInput) {
  const userId = await requireUserId()
  const parsed = createIncomeActionSchema.parse(data)
  if (parsed.tripId) await assertOwnsTrip(userId, parsed.tripId)
  const dek = await getDekForUser(userId)

  await db.insert(incomes).values({
    userId,
    referenceMonth: parsed.referenceMonth,
    source: encryptField(parsed.source, dek),
    amount: encryptField(parsed.amount, dek),
    investmentReturnCapital: encryptOptional(null, dek),
    tripId: parsed.tripId ?? null,
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  if (parsed.tripId) revalidatePath('/viagens')
}

export type UpdateIncomeInput = {
  id: string
  source: string
  amount: string
  tripId?: string
}

export async function updateIncome(data: UpdateIncomeInput) {
  const userId = await requireUserId()
  const parsed = updateIncomeActionSchema.parse(data)
  if (parsed.tripId) {
    // Entrada criada por resgate segue a regra do resgate: só destino "caixa" aceita
    // viagem — mesma checagem de withdrawalSchema e updateWithdrawal
    const [, [withdrawal]] = await Promise.all([
      assertOwnsTrip(userId, parsed.tripId),
      db
        .select({ destination: investmentWithdrawals.destination })
        .from(investmentWithdrawals)
        .where(
          and(
            eq(investmentWithdrawals.incomeId, parsed.id),
            eq(investmentWithdrawals.userId, userId)
          )
        )
        .limit(1),
    ])
    if (withdrawal && withdrawal.destination !== 'income') {
      throw new Error('Só resgates para o caixa podem ser vinculados a uma viagem')
    }
  }
  const dek = await getDekForUser(userId)

  await db
    .update(incomes)
    .set({
      source: encryptField(parsed.source, dek),
      amount: encryptField(parsed.amount, dek),
      tripId: parsed.tripId ?? null,
    })
    .where(and(eq(incomes.id, parsed.id), eq(incomes.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/viagens')
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { ok: false, code: 'not_found', message: 'Entrada não encontrada.' }

  // Entrada criada por resgate ou pagamento de devedor pertence a essa entidade: os FKs
  // são ON DELETE SET NULL, então apagar a entrada aqui desvincularia o par em silêncio
  const [[withdrawal], [debtEntry]] = await Promise.all([
    db
      .select({ id: investmentWithdrawals.id })
      .from(investmentWithdrawals)
      .where(
        and(
          eq(investmentWithdrawals.incomeId, parsed.data),
          eq(investmentWithdrawals.userId, userId)
        )
      )
      .limit(1),
    db
      .select({ id: debtorEntries.id })
      .from(debtorEntries)
      .where(and(eq(debtorEntries.incomeId, parsed.data), eq(debtorEntries.userId, userId)))
      .limit(1),
  ])
  if (withdrawal) {
    return {
      ok: false,
      code: 'income_owned_by_withdrawal',
      message: 'Esta entrada veio de um resgate. Exclua o resgate em Investimentos.',
    }
  }
  if (debtEntry) {
    return {
      ok: false,
      code: 'income_owned_by_debt_payment',
      message: 'Esta entrada veio de um pagamento de devedor. Exclua o pagamento em Devedores.',
    }
  }

  await db.delete(incomes).where(and(eq(incomes.id, parsed.data), eq(incomes.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/viagens')
  return { ok: true, data: undefined }
}
