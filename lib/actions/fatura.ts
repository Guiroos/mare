'use server'

import { eq, isNotNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { transactions, userSettings } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsPaymentAccount } from '@/lib/auth/ownership'
import { creditModeSchema } from '@/lib/validations/settings'
import { faturaPaymentActionSchema } from '@/lib/validations/fatura'
import { dateToReferenceMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { getFaturaState } from '@/lib/queries/fatura'

export async function updateCreditMode(data: unknown) {
  const userId = await requireUserId()
  const parsed = creditModeSchema.parse(data)

  if (parsed.creditMode === 'fatura') {
    const eligibleAccount = await db.query.paymentAccounts.findFirst({
      where: (a, { and, eq, gt }) =>
        and(eq(a.userId, userId), eq(a.type, 'credit'), gt(a.closingDay, 1)),
      columns: { id: true },
    })
    if (!eligibleAccount) {
      throw new Error(
        'Nenhum cartão de crédito com data de fechamento cadastrada. Configure um cartão antes de ativar o regime de fatura.'
      )
    }
  }

  const hasFaturaPayments = await db.query.transactions.findFirst({
    where: (t, { and }) => and(eq(t.userId, userId), isNotNull(t.faturaAccountId)),
    columns: { id: true },
  })

  if (hasFaturaPayments) {
    throw new Error(
      'Não é possível alterar o regime de fatura enquanto houver pagamentos de fatura registrados. Delete os pagamentos e tente novamente.'
    )
  }

  const faturaActiveFrom =
    parsed.creditMode === 'fatura' && parsed.faturaActiveFrom
      ? yearMonthToReferenceMonth(parsed.faturaActiveFrom)
      : null

  await db
    .insert(userSettings)
    .values({
      userId,
      creditMode: parsed.creditMode,
      faturaActiveFrom,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userSettings.userId],
      set: {
        creditMode: parsed.creditMode,
        faturaActiveFrom,
        updatedAt: new Date(),
      },
    })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/contas')
}

export async function createFaturaPayment(data: unknown) {
  const userId = await requireUserId()
  const parsed = faturaPaymentActionSchema.parse(data)

  await Promise.all([
    assertOwnsPaymentAccount(userId, parsed.faturaAccountId),
    assertOwnsPaymentAccount(userId, parsed.sourceAccountId),
  ])

  const [faturaAccount, sourceAccount] = await Promise.all([
    db.query.paymentAccounts.findFirst({
      where: (a, { and, eq }) => and(eq(a.id, parsed.faturaAccountId), eq(a.userId, userId)),
      columns: { id: true, type: true, closingDay: true },
    }),
    db.query.paymentAccounts.findFirst({
      where: (a, { and, eq }) => and(eq(a.id, parsed.sourceAccountId), eq(a.userId, userId)),
      columns: { id: true, type: true },
    }),
  ])

  if (!faturaAccount || faturaAccount.type !== 'credit') {
    throw new Error('Conta de crédito inválida')
  }
  if (!faturaAccount.closingDay || faturaAccount.closingDay <= 1) {
    throw new Error('Conta de crédito sem data de fechamento configurada')
  }
  if (!sourceAccount || sourceAccount.type === 'credit') {
    throw new Error('Conta de origem deve ser débito ou pix')
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { creditMode: true, faturaActiveFrom: true },
  })

  if (!settings || settings.creditMode !== 'fatura' || !settings.faturaActiveFrom) {
    throw new Error('Regime de fatura não está ativo')
  }
  if (parsed.faturaCycleMonth < settings.faturaActiveFrom) {
    throw new Error('Ciclo anterior à ativação do regime de fatura')
  }

  const cycleState = await getFaturaState(userId, parsed.faturaAccountId, parsed.faturaCycleMonth)
  if (!cycleState) {
    throw new Error('Ciclo de faturamento não encontrado')
  }

  if (parsed.date <= cycleState.cycleEnd) {
    throw new Error('Data de pagamento deve ser posterior ao fechamento do ciclo')
  }

  if (cycleState.total <= 0) {
    throw new Error('Não há fatura a pagar para este ciclo')
  }

  const serverTotalCents = Math.round(cycleState.total * 100)
  const clientTotalCents = Math.round(toAmount(parsed.amount) * 100)
  if (serverTotalCents !== clientTotalCents) {
    throw new Error('O valor da fatura mudou. Feche e reabra o dialog para ver o valor atualizado.')
  }

  const existingPayment = await db.query.transactions.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.userId, userId),
        eq(t.faturaAccountId, parsed.faturaAccountId),
        eq(t.faturaCycleMonth, parsed.faturaCycleMonth)
      ),
    columns: { id: true },
  })
  if (existingPayment) {
    throw new Error('Já existe um pagamento registrado para este ciclo')
  }

  const referenceMonth = dateToReferenceMonth(parsed.date)

  await db.insert(transactions).values({
    userId,
    accountId: parsed.sourceAccountId,
    faturaAccountId: parsed.faturaAccountId,
    faturaCycleMonth: parsed.faturaCycleMonth,
    categoryId: null,
    name: `Pagamento fatura ${cycleState.account.name}`,
    amount: parsed.amount.toString(),
    date: parsed.date,
    referenceMonth,
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}
