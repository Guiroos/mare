'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { people, debtorEntries, incomes, transactions } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsPerson, assertOwnsDebtEntry } from '@/lib/auth/ownership'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional, decryptField } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'
import {
  personSchema,
  updatePersonActionSchema,
  debtChargeSchema,
  debtChargeFromTransactionSchema,
  debtPaymentSchema,
  settleChargeSchema,
} from '@/lib/validations/debtors'

// ─── Pessoas ──────────────────────────────────────────────────────────────────

export type CreatePersonInput = {
  name: string
  email?: string
  phone?: string
  notes?: string
}

export async function createPerson(data: CreatePersonInput) {
  const userId = await requireUserId()
  personSchema.parse(data)

  const dek = await getDekForUser(userId)

  await db.insert(people).values({
    userId,
    name: encryptField(data.name.trim(), dek),
    email: encryptOptional(data.email?.trim() || null, dek),
    phone: encryptOptional(data.phone?.trim() || null, dek),
    notes: encryptOptional(data.notes?.trim() || null, dek),
  })

  revalidatePath('/devedores')
}

export type UpdatePersonInput = CreatePersonInput & { id: string }

export async function updatePerson(data: UpdatePersonInput) {
  const userId = await requireUserId()
  updatePersonActionSchema.parse(data)
  await assertOwnsPerson(userId, data.id)

  const dek = await getDekForUser(userId)

  await db
    .update(people)
    .set({
      name: encryptField(data.name.trim(), dek),
      email: encryptOptional(data.email?.trim() || null, dek),
      phone: encryptOptional(data.phone?.trim() || null, dek),
      notes: encryptOptional(data.notes?.trim() || null, dek),
      updatedAt: new Date(),
    })
    .where(and(eq(people.id, data.id), eq(people.userId, userId)))

  revalidatePath('/devedores')
}

export async function archivePerson(id: string) {
  const userId = await requireUserId()
  await assertOwnsPerson(userId, id)

  await db
    .update(people)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(people.id, id), eq(people.userId, userId)))

  revalidatePath('/devedores')
}

export async function deletePersonIfEmpty(id: string) {
  const userId = await requireUserId()
  await assertOwnsPerson(userId, id)

  const existing = await db.query.debtorEntries.findFirst({
    where: and(eq(debtorEntries.personId, id), eq(debtorEntries.userId, userId)),
    columns: { id: true },
  })

  if (existing) {
    throw new Error('Não é possível excluir uma pessoa com lançamentos. Use arquivar.')
  }

  await db.delete(people).where(and(eq(people.id, id), eq(people.userId, userId)))

  revalidatePath('/devedores')
}

// ─── Lançamentos ──────────────────────────────────────────────────────────────

function entryDateToReferenceMonth(entryDate: string): string {
  return entryDate.slice(0, 7) + '-01'
}

export type CreateDebtChargeInput = {
  personId: string
  amount: string
  description: string
  entryDate: string
  notes?: string
}

export async function createDebtCharge(data: CreateDebtChargeInput) {
  const userId = await requireUserId()
  debtChargeSchema.parse(data)
  await assertOwnsPerson(userId, data.personId)

  const dek = await getDekForUser(userId)

  await db.insert(debtorEntries).values({
    userId,
    personId: data.personId,
    type: 'charge',
    status: 'open',
    amount: encryptField(String(data.amount), dek),
    description: encryptField(data.description.trim(), dek),
    entryDate: data.entryDate,
    referenceMonth: entryDateToReferenceMonth(data.entryDate),
    notes: encryptOptional(data.notes?.trim() || null, dek),
  })

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
}

export type CreateDebtChargeFromTransactionInput = CreateDebtChargeInput & {
  sourceTransactionId: string
}

export async function createDebtChargeFromTransaction(data: CreateDebtChargeFromTransactionInput) {
  const userId = await requireUserId()
  debtChargeFromTransactionSchema.parse(data)

  const [tx, dek] = await Promise.all([
    db.query.transactions.findFirst({
      where: and(eq(transactions.id, data.sourceTransactionId), eq(transactions.userId, userId)),
      columns: { id: true },
    }),
    getDekForUser(userId),
    assertOwnsPerson(userId, data.personId),
  ])

  if (!tx) throw new Error('Transação não encontrada.')

  await db.insert(debtorEntries).values({
    userId,
    personId: data.personId,
    type: 'charge',
    status: 'open',
    amount: encryptField(String(data.amount), dek),
    description: encryptField(data.description.trim(), dek),
    entryDate: data.entryDate,
    referenceMonth: entryDateToReferenceMonth(data.entryDate),
    notes: encryptOptional(data.notes?.trim() || null, dek),
    sourceTransactionId: data.sourceTransactionId,
  })

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
}

export type CreateDebtPaymentInput = {
  personId: string
  amount: string
  description: string
  entryDate: string
  createIncome: boolean
  referenceMonth?: string
  settleChargeIds?: string[]
  reconcileRemainder?: boolean
  notes?: string
}

export async function createDebtPayment(data: CreateDebtPaymentInput) {
  const userId = await requireUserId()
  debtPaymentSchema.parse(data)

  const [person, dek] = await Promise.all([
    db.query.people.findFirst({
      where: and(eq(people.userId, userId), eq(people.id, data.personId)),
      columns: { name: true },
    }),
    getDekForUser(userId),
    assertOwnsPerson(userId, data.personId),
  ])

  if (!person) throw new Error('Pessoa não encontrada')

  let incomeId: string | null = null
  let paymentEntryId: string | null = null

  await db.transaction(async (tx) => {
    if (data.createIncome && data.referenceMonth) {
      const [created] = await tx
        .insert(incomes)
        .values({
          userId,
          source: `${person.name} — ${data.description}`,
          amount: data.amount,
          referenceMonth: data.referenceMonth,
        })
        .returning({ id: incomes.id })
      incomeId = created.id
    }

    const [payment] = await tx
      .insert(debtorEntries)
      .values({
        userId,
        personId: data.personId,
        type: 'payment',
        amount: encryptField(String(data.amount), dek),
        description: encryptField(data.description.trim(), dek),
        entryDate: data.entryDate,
        referenceMonth: data.referenceMonth ?? entryDateToReferenceMonth(data.entryDate),
        notes: encryptOptional(data.notes?.trim() || null, dek),
        incomeId,
      })
      .returning({ id: debtorEntries.id })
    paymentEntryId = payment.id

    if (data.settleChargeIds && data.settleChargeIds.length > 0) {
      const chargeRows = await tx
        .select({ amount: debtorEntries.amount })
        .from(debtorEntries)
        .where(
          and(
            inArray(debtorEntries.id, data.settleChargeIds),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'charge')
          )
        )
      const chargesTotal = chargeRows.reduce(
        (sum, r) => sum + toAmount(decryptField(r.amount, dek)),
        0
      )

      await tx
        .update(debtorEntries)
        .set({ status: 'settled', settledByPaymentId: paymentEntryId })
        .where(
          and(
            inArray(debtorEntries.id, data.settleChargeIds),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'charge')
          )
        )

      if (data.reconcileRemainder) {
        const diffCents = Math.round((chargesTotal - Number(data.amount)) * 100)
        if (diffCents > 0) {
          const adjustmentAmount = (-diffCents / 100).toFixed(2)
          await tx.insert(debtorEntries).values({
            userId,
            personId: data.personId,
            type: 'adjustment',
            amount: encryptField(adjustmentAmount, dek),
            description: encryptField('Abatimento — conciliação de pagamento', dek),
            entryDate: data.entryDate,
            referenceMonth: data.referenceMonth ?? entryDateToReferenceMonth(data.entryDate),
            status: null,
            settledByPaymentId: paymentEntryId,
          })
        }
      }
    }
  })

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
  if (incomeId) {
    revalidatePath('/dashboard')
    revalidatePath('/panorama')
  }
}

export type SettleChargeInput = {
  chargeId: string
  personId: string
  entryDate: string
  createIncome: boolean
  referenceMonth?: string
  notes?: string
}

export async function settleCharge(data: SettleChargeInput): Promise<void> {
  const userId = await requireUserId()
  settleChargeSchema.parse(data)
  const [, dek] = await Promise.all([
    Promise.all([
      assertOwnsDebtEntry(userId, data.chargeId),
      assertOwnsPerson(userId, data.personId),
    ]),
    getDekForUser(userId),
  ])

  const charge = await db.query.debtorEntries.findFirst({
    where: and(eq(debtorEntries.id, data.chargeId), eq(debtorEntries.userId, userId)),
    columns: {
      id: true,
      type: true,
      status: true,
      amount: true,
      description: true,
      personId: true,
    },
  })

  if (!charge) throw new Error('Cobrança não encontrada')
  if (charge.type !== 'charge') throw new Error('Lançamento não é uma cobrança')
  if (charge.status === 'settled') throw new Error('Cobrança já está quitada')

  let incomeId: string | null = null

  await db.transaction(async (tx) => {
    if (data.createIncome && data.referenceMonth) {
      const person = await tx.query.people.findFirst({
        where: and(eq(people.userId, userId), eq(people.id, data.personId)),
        columns: { name: true },
      })
      if (!person) throw new Error('Pessoa não encontrada')
      const [created] = await tx
        .insert(incomes)
        .values({
          userId,
          source: `${person.name} — ${charge.description}`,
          amount: charge.amount,
          referenceMonth: data.referenceMonth,
        })
        .returning({ id: incomes.id })
      incomeId = created.id
    }

    const [payment] = await tx
      .insert(debtorEntries)
      .values({
        userId,
        personId: data.personId,
        type: 'payment',
        amount: charge.amount,
        description: charge.description,
        entryDate: data.entryDate,
        referenceMonth: data.referenceMonth ?? entryDateToReferenceMonth(data.entryDate),
        notes: encryptOptional(data.notes?.trim() || null, dek),
        incomeId,
      })
      .returning({ id: debtorEntries.id })

    await tx
      .update(debtorEntries)
      .set({ status: 'settled', settledByPaymentId: payment.id })
      .where(and(eq(debtorEntries.id, data.chargeId), eq(debtorEntries.userId, userId)))
  })

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
  if (incomeId) {
    revalidatePath('/dashboard')
    revalidatePath('/panorama')
  }
}

export type DeleteDebtEntryInput = {
  id: string
  alsoDeleteIncome?: boolean
}

export async function deleteDebtEntry(data: DeleteDebtEntryInput) {
  const userId = await requireUserId()
  await assertOwnsDebtEntry(userId, data.id)

  const entry = await db.query.debtorEntries.findFirst({
    where: and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)),
    columns: { id: true, type: true, personId: true, incomeId: true },
  })

  if (!entry) throw new Error('Lançamento não encontrado')

  if (entry.type === 'payment') {
    await db.transaction(async (tx) => {
      // Reopen settled charges BEFORE deleting the payment to avoid relying on the FK SET NULL
      // (which clears settledByPaymentId but does not reset status).
      await tx
        .update(debtorEntries)
        .set({ status: 'open', settledByPaymentId: null })
        .where(and(eq(debtorEntries.settledByPaymentId, data.id), eq(debtorEntries.userId, userId)))

      if (data.alsoDeleteIncome && entry.incomeId) {
        await tx
          .delete(incomes)
          .where(and(eq(incomes.id, entry.incomeId), eq(incomes.userId, userId)))
      }

      await tx
        .delete(debtorEntries)
        .where(and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)))
    })
  } else {
    await db.transaction(async (tx) => {
      if (data.alsoDeleteIncome && entry.incomeId) {
        await tx
          .delete(incomes)
          .where(and(eq(incomes.id, entry.incomeId), eq(incomes.userId, userId)))
      }

      await tx
        .delete(debtorEntries)
        .where(and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)))
    })
  }

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${entry.personId}`)

  if (data.alsoDeleteIncome && entry.incomeId) {
    revalidatePath('/dashboard')
    revalidatePath('/panorama')
  }
}
