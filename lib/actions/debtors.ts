'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { people, debtorEntries, incomes, transactions } from '@/lib/db/schema'
import { eq, and, or, isNull, inArray } from 'drizzle-orm'
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
  updateDebtEntrySchema,
  debtPaymentSchema,
  settleChargeSchema,
} from '@/lib/validations/debtors'
import { uuidSchema } from '@/lib/validations/utils'
import { generateShareToken, hashShareToken } from '@/lib/utils/share-token'
import { getRequestOrigin } from '@/lib/utils/request-origin'
import { dateToReferenceMonth } from '@/lib/utils/date'
import type { ActionResult } from '@/lib/actions/types'

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

  // Zera o link público junto: arquivar é o gesto de "essa relação acabou", e
  // sem isso o extrato continuaria servindo dado vivo para quem tem a URL.
  await db
    .update(people)
    .set({ archived: true, shareTokenHash: null, shareToken: null, updatedAt: new Date() })
    .where(and(eq(people.id, id), eq(people.userId, userId)))

  revalidatePath('/devedores')
}

export async function deletePersonIfEmpty(id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  await assertOwnsPerson(userId, id)

  const existing = await db.query.debtorEntries.findFirst({
    where: and(eq(debtorEntries.personId, id), eq(debtorEntries.userId, userId)),
    columns: { id: true },
  })

  if (existing) {
    return {
      ok: false,
      code: 'person_has_entries',
      message: 'Não é possível excluir uma pessoa com lançamentos. Use arquivar.',
    }
  }

  await db.delete(people).where(and(eq(people.id, id), eq(people.userId, userId)))

  revalidatePath('/devedores')

  return { ok: true, data: undefined }
}

// ─── Lançamentos ──────────────────────────────────────────────────────────────

// Cobrança aberta: `null` e 'open' são equivalentes (pré-migration ficaram como null).
const openChargeStatus = or(eq(debtorEntries.status, 'open'), isNull(debtorEntries.status))

class ChargeAlreadySettledError extends Error {}

const chargeAlreadySettled = (): ActionResult => ({
  ok: false,
  code: 'charge_already_settled',
  message: 'Uma das cobranças selecionadas já foi quitada. Feche e abra de novo.',
})

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
    referenceMonth: dateToReferenceMonth(data.entryDate),
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
    referenceMonth: dateToReferenceMonth(data.entryDate),
    notes: encryptOptional(data.notes?.trim() || null, dek),
    sourceTransactionId: data.sourceTransactionId,
  })

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
}

export type UpdateDebtEntryInput = {
  id: string
  amount: string
  amountSign?: 'positive' | 'negative'
  description: string
  entryDate: string
  notes?: string
}

export async function updateDebtEntry(data: UpdateDebtEntryInput) {
  const userId = await requireUserId()
  updateDebtEntrySchema.parse(data)
  await assertOwnsDebtEntry(userId, data.id)

  const entry = await db.query.debtorEntries.findFirst({
    where: and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)),
    columns: {
      type: true,
      personId: true,
      incomeId: true,
      referenceMonth: true,
      amount: true,
      description: true,
    },
  })

  if (!entry) throw new Error('Lançamento não encontrado')

  const dek = await getDekForUser(userId)

  const description = data.description.trim()
  // `amountSign` ausente preserva o sinal atual: omitir o campo não pode inverter
  // um abatimento existente. A coluna é cifrada — o sinal só aparece após decrypt,
  // testar `entry.amount.startsWith('-')` no valor cru leria ciphertext.
  const sign =
    data.amountSign ?? (toAmount(decryptField(entry.amount, dek)) < 0 ? 'negative' : 'positive')
  // Só ajustes carregam sinal — cobranças e pagamentos são sempre positivos e o
  // sentido no saldo vem do `type`.
  const magnitude = Math.abs(parseFloat(data.amount)).toFixed(2)
  const amount = entry.type === 'adjustment' && sign === 'negative' ? `-${magnitude}` : magnitude

  // Lançamento com entrada vinculada mantém o referenceMonth escolhido no registro:
  // derivá-lo de entryDate moveria a entrada de mês no fluxo de caixa sem o usuário pedir.
  const referenceMonth = entry.incomeId
    ? entry.referenceMonth
    : dateToReferenceMonth(data.entryDate)

  const entryValues = {
    amount: encryptField(amount, dek),
    description: encryptField(description, dek),
    entryDate: data.entryDate,
    referenceMonth,
    notes: encryptOptional(data.notes?.trim() || null, dek),
    updatedAt: new Date(),
  }

  // O rótulo da entrada (`incomes.source`) é editável pelo usuário no dashboard:
  // só é regravado quando a descrição do lançamento mudou de fato.
  const descriptionChanged = decryptField(entry.description, dek) !== description

  await db.transaction(async (tx) => {
    if (entry.incomeId) {
      const incomeValues: { amount: string; source?: string } = {
        amount: encryptField(amount, dek),
      }
      if (descriptionChanged) {
        const person = await tx.query.people.findFirst({
          where: and(eq(people.id, entry.personId), eq(people.userId, userId)),
          columns: { name: true },
        })
        if (!person) throw new Error('Pessoa não encontrada')
        // Mesmo formato usado ao criar a entrada em createDebtPayment/settleCharge.
        incomeValues.source = encryptField(
          `${decryptField(person.name, dek)} — ${description}`,
          dek
        )
      }
      await tx
        .update(incomes)
        .set(incomeValues)
        .where(and(eq(incomes.id, entry.incomeId), eq(incomes.userId, userId)))
    }

    if (entry.type === 'payment') {
      // Ajuste de conciliação criado junto deste pagamento: recalcular pelo novo valor.
      const [adjustment] = await tx
        .select({ id: debtorEntries.id })
        .from(debtorEntries)
        .where(
          and(
            eq(debtorEntries.settledByPaymentId, data.id),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'adjustment')
          )
        )
      if (adjustment) {
        const settled = await tx
          .select({ amount: debtorEntries.amount })
          .from(debtorEntries)
          .where(
            and(
              eq(debtorEntries.settledByPaymentId, data.id),
              eq(debtorEntries.userId, userId),
              eq(debtorEntries.type, 'charge')
            )
          )
        const chargesCents = settled.reduce(
          (sum, r) => sum + Math.round(toAmount(decryptField(r.amount, dek)) * 100),
          0
        )
        const diffCents = chargesCents - Math.round(toAmount(amount) * 100)
        if (diffCents > 0) {
          await tx
            .update(debtorEntries)
            .set({
              amount: encryptField((-diffCents / 100).toFixed(2), dek),
              updatedAt: new Date(),
            })
            .where(and(eq(debtorEntries.id, adjustment.id), eq(debtorEntries.userId, userId)))
        } else {
          await tx
            .delete(debtorEntries)
            .where(and(eq(debtorEntries.id, adjustment.id), eq(debtorEntries.userId, userId)))
        }
      }
    }

    await tx
      .update(debtorEntries)
      .set(entryValues)
      .where(and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)))
  })

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${entry.personId}`)
  if (entry.incomeId) {
    revalidatePath('/dashboard')
    revalidatePath('/panorama')
  }
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

export async function createDebtPayment(data: CreateDebtPaymentInput): Promise<ActionResult> {
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

  try {
    await db.transaction(async (tx) => {
      if (data.createIncome && data.referenceMonth) {
        const [created] = await tx
          .insert(incomes)
          .values({
            userId,
            source: encryptField(
              `${decryptField(person.name, dek)} — ${data.description.trim()}`,
              dek
            ),
            amount: encryptField(data.amount, dek),
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
          referenceMonth: data.referenceMonth ?? dateToReferenceMonth(data.entryDate),
          notes: encryptOptional(data.notes?.trim() || null, dek),
          incomeId,
        })
        .returning({ id: debtorEntries.id })
      paymentEntryId = payment.id

      if (data.settleChargeIds && data.settleChargeIds.length > 0) {
        const chargeIds = [...new Set(data.settleChargeIds)]
        // Só cobranças ainda abertas: sem o filtro de status, um pagamento feito
        // numa aba velha re-aponta a cobrança para si e apagá-lo reabriria uma
        // dívida que o pagamento original quitou.
        const settledRows = await tx
          .update(debtorEntries)
          .set({ status: 'settled', settledByPaymentId: paymentEntryId })
          .where(
            and(
              inArray(debtorEntries.id, chargeIds),
              eq(debtorEntries.userId, userId),
              eq(debtorEntries.type, 'charge'),
              openChargeStatus
            )
          )
          .returning({ amount: debtorEntries.amount })
        // Lança dentro da transação: desfaz o pagamento (e a entrada) já inseridos.
        if (settledRows.length !== chargeIds.length) throw new ChargeAlreadySettledError()
        const chargesTotal = settledRows.reduce(
          (sum, r) => sum + toAmount(decryptField(r.amount, dek)),
          0
        )

        if (data.reconcileRemainder) {
          const diffCents = Math.round((chargesTotal - toAmount(data.amount)) * 100)
          if (diffCents > 0) {
            const adjustmentAmount = (-diffCents / 100).toFixed(2)
            await tx.insert(debtorEntries).values({
              userId,
              personId: data.personId,
              type: 'adjustment',
              amount: encryptField(adjustmentAmount, dek),
              description: encryptField('Abatimento — conciliação de pagamento', dek),
              entryDate: data.entryDate,
              referenceMonth: data.referenceMonth ?? dateToReferenceMonth(data.entryDate),
              status: null,
              settledByPaymentId: paymentEntryId,
            })
          }
        }
      }
    })
  } catch (err) {
    if (err instanceof ChargeAlreadySettledError) return chargeAlreadySettled()
    throw err
  }

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
  if (incomeId) {
    revalidatePath('/dashboard')
    revalidatePath('/panorama')
  }

  return { ok: true, data: undefined }
}

export type SettleChargeInput = {
  chargeId: string
  personId: string
  entryDate: string
  createIncome: boolean
  referenceMonth?: string
  notes?: string
}

export async function settleCharge(data: SettleChargeInput): Promise<ActionResult> {
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
  if (charge.type !== 'charge') {
    return { ok: false, code: 'entry_not_a_charge', message: 'Lançamento não é uma cobrança' }
  }
  if (charge.status === 'settled') {
    return { ok: false, code: 'charge_already_settled', message: 'Cobrança já está quitada' }
  }

  let incomeId: string | null = null

  try {
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
            source: encryptField(
              `${decryptField(person.name, dek)} — ${decryptField(charge.description, dek)}`,
              dek
            ),
            amount: encryptField(decryptField(charge.amount, dek), dek),
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
          amount: encryptField(decryptField(charge.amount, dek), dek),
          description: encryptField(decryptField(charge.description, dek), dek),
          entryDate: data.entryDate,
          referenceMonth: data.referenceMonth ?? dateToReferenceMonth(data.entryDate),
          notes: encryptOptional(data.notes?.trim() || null, dek),
          incomeId,
        })
        .returning({ id: debtorEntries.id })

      // A checagem de status lá em cima roda fora da transação: o filtro aqui
      // fecha a janela de corrida (duas abas quitando a mesma cobrança).
      const updated = await tx
        .update(debtorEntries)
        .set({ status: 'settled', settledByPaymentId: payment.id })
        .where(
          and(
            eq(debtorEntries.id, data.chargeId),
            eq(debtorEntries.userId, userId),
            openChargeStatus
          )
        )
        .returning({ id: debtorEntries.id })
      if (updated.length === 0) throw new ChargeAlreadySettledError()
    })
  } catch (err) {
    if (err instanceof ChargeAlreadySettledError) {
      return { ok: false, code: 'charge_already_settled', message: 'Cobrança já está quitada' }
    }
    throw err
  }

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${data.personId}`)
  if (incomeId) {
    revalidatePath('/dashboard')
    revalidatePath('/panorama')
  }

  return { ok: true, data: undefined }
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
      // Ajustes de conciliação criados junto deste pagamento: deletar.
      await tx
        .delete(debtorEntries)
        .where(
          and(
            eq(debtorEntries.settledByPaymentId, data.id),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'adjustment')
          )
        )

      // Cobranças quitadas por este pagamento: reabrir ANTES de deletar o pagamento
      // (o FK SET NULL limpa settledByPaymentId mas não reseta status).
      await tx
        .update(debtorEntries)
        .set({ status: 'open', settledByPaymentId: null })
        .where(
          and(
            eq(debtorEntries.settledByPaymentId, data.id),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'charge')
          )
        )

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

// ─── Link público de extrato ──────────────────────────────────────────────────

/**
 * Generates (or rotates) a person's public statement link.
 * There is no separate "revoke": writing a new hash already invalidates the previous link.
 */
export async function generateShareLink(personId: string): Promise<{ url: string }> {
  const userId = await requireUserId()
  const id = uuidSchema.parse(personId)
  await assertOwnsPerson(userId, id)

  const token = generateShareToken()
  const dek = await getDekForUser(userId)

  await db
    .update(people)
    .set({
      shareTokenHash: hashShareToken(token),
      shareToken: encryptField(token, dek),
      updatedAt: new Date(),
    })
    .where(and(eq(people.id, id), eq(people.userId, userId)))

  revalidatePath(`/devedores/${id}`)

  return { url: `${await getRequestOrigin()}/e/${token}` }
}
