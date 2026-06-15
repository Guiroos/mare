import { vi, describe, it, expect, beforeAll } from 'vitest'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createCategoryGroup,
  createCategory,
  createAccount,
  createPerson,
} from './helpers/factories'

// UUID válido que nunca existirá no banco — passa a validação Zod mas ownership rejeita
const FOREIGN_UUID = '00000000-0000-0000-0000-000000000000'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsCategory: vi.fn(),
  assertOwnsPaymentAccount: vi.fn(),
  assertOwnsPerson: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let categoryId: string
let accountId: string
let personId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-transactions-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
  ;({ id: accountId } = await createAccount(db, userId))
  ;({ id: personId } = await createPerson(db, userId, 'Pessoa Split'))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const { assertOwnsCategory, assertOwnsPaymentAccount, assertOwnsPerson } =
    await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsCategory).mockResolvedValue(undefined)
  vi.mocked(assertOwnsPaymentAccount).mockResolvedValue(undefined)
  vi.mocked(assertOwnsPerson).mockResolvedValue(undefined)
})

// ─── createInstallmentPurchase ────────────────────────────────────────────────

describe('createInstallmentPurchase', () => {
  it('cria o grupo e N transações com nomes, valores e referenceMonth corretos', async () => {
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    vi.mocked(revalidatePath).mockClear()
    await createInstallmentPurchase({
      name: 'Notebook',
      totalAmount: '3000.00',
      totalInstallments: 3,
      startDate: '2025-01-10',
      categoryId,
      accountId,
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) => and(eqFn(g.userId, userId), eqFn(g.name, 'Notebook')),
    })

    expect(group).toBeDefined()
    expect(group?.totalInstallments).toBe(3)
    expect(group?.totalAmount).toBe('3000.00')

    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })

    expect(txs).toHaveLength(3)

    // Nomes no formato "Nome (i/N)"
    expect(txs[0].name).toBe('Notebook (1/3)')
    expect(txs[1].name).toBe('Notebook (2/3)')
    expect(txs[2].name).toBe('Notebook (3/3)')

    // installmentNumber e totalInstallments
    expect(txs[0].installmentNumber).toBe(1)
    expect(txs[2].installmentNumber).toBe(3)
    expect(txs.every((t) => t.totalInstallments === 3)).toBe(true)

    // referenceMonth avança um mês por parcela
    expect(txs[0].referenceMonth).toBe('2025-01-01')
    expect(txs[1].referenceMonth).toBe('2025-02-01')
    expect(txs[2].referenceMonth).toBe('2025-03-01')

    // Valor de cada parcela
    expect(txs[0].amount).toBe('1000.00')
    expect(txs[1].amount).toBe('1000.00')
    expect(txs[2].amount).toBe('1000.00')

    // Todos vinculados ao usuário, categoria e conta corretos
    expect(txs.every((t) => t.userId === userId)).toBe(true)
    expect(txs.every((t) => t.categoryId === categoryId)).toBe(true)
    expect(txs.every((t) => t.accountId === accountId)).toBe(true)

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/panorama')
  })

  it('rejeita quando categoria não pertence ao usuário', async () => {
    const { assertOwnsCategory } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsCategory).mockRejectedValueOnce(new Error('Não autorizado'))

    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await expect(
      createInstallmentPurchase({
        name: 'TV',
        totalAmount: '2000.00',
        totalInstallments: 2,
        startDate: '2025-01-01',
        categoryId: FOREIGN_UUID,
        accountId,
      })
    ).rejects.toThrow('Não autorizado')
  })

  it('rejeita quando conta não pertence ao usuário', async () => {
    const { assertOwnsPaymentAccount } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPaymentAccount).mockRejectedValueOnce(new Error('Não autorizado'))

    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await expect(
      createInstallmentPurchase({
        name: 'Geladeira',
        totalAmount: '1500.00',
        totalInstallments: 6,
        startDate: '2025-02-01',
        categoryId,
        accountId: FOREIGN_UUID,
      })
    ).rejects.toThrow('Não autorizado')
  })

  it('rejeita input inválido sem escrever no banco', async () => {
    const countBefore = await db
      .select({ id: schema.installmentGroups.id })
      .from(schema.installmentGroups)
      .where(eq(schema.installmentGroups.userId, userId))

    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await expect(
      createInstallmentPurchase({
        name: '',
        totalAmount: '-100',
        totalInstallments: 0,
        startDate: 'data-invalida',
        categoryId,
        accountId,
      })
    ).rejects.toThrow()

    const countAfter = await db
      .select({ id: schema.installmentGroups.id })
      .from(schema.installmentGroups)
      .where(eq(schema.installmentGroups.userId, userId))

    expect(countAfter).toHaveLength(countBefore.length)
  })

  it('conta crédito: compra antes do fechamento → parcela 1 no mês da compra, parcelas 2+ com closingDay+1', async () => {
    const creditAccount = await createAccount(db, userId, { type: 'credit', closingDay: 16 })
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'TV antes fechamento',
      totalAmount: '1200.00',
      totalInstallments: 3,
      startDate: '2025-01-05',
      categoryId,
      accountId: creditAccount.id,
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) =>
        and(eqFn(g.userId, userId), eqFn(g.name, 'TV antes fechamento')),
    })
    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })

    // Parcela 1: data real da compra, referenceMonth no mês da compra (5 ≤ 16)
    expect(txs[0].date).toBe('2025-01-05')
    expect(txs[0].referenceMonth).toBe('2025-01-01')
    // Parcelas 2+: dia 17 (closingDay+1) do mês anterior
    expect(txs[1].date).toBe('2025-01-17')
    expect(txs[1].referenceMonth).toBe('2025-02-01')
    expect(txs[2].date).toBe('2025-02-17')
    expect(txs[2].referenceMonth).toBe('2025-03-01')
  })

  it('conta crédito: compra depois do fechamento → parcela 1 no mês seguinte', async () => {
    const creditAccount = await createAccount(db, userId, { type: 'credit', closingDay: 16 })
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'TV depois fechamento',
      totalAmount: '1200.00',
      totalInstallments: 3,
      startDate: '2025-01-18',
      categoryId,
      accountId: creditAccount.id,
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) =>
        and(eqFn(g.userId, userId), eqFn(g.name, 'TV depois fechamento')),
    })
    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })

    // Parcela 1: data real da compra, referenceMonth no mês seguinte (18 > 16)
    expect(txs[0].date).toBe('2025-01-18')
    expect(txs[0].referenceMonth).toBe('2025-02-01')
    // Parcelas 2+: dia 17 do mês anterior ao referenceMonth
    expect(txs[1].date).toBe('2025-02-17')
    expect(txs[1].referenceMonth).toBe('2025-03-01')
    expect(txs[2].date).toBe('2025-03-17')
    expect(txs[2].referenceMonth).toBe('2025-04-01')
  })

  it('conta crédito closingDay=28, compra em 30/jan → fallback dia 1 de março na parcela 2', async () => {
    const creditAccount = await createAccount(db, userId, { type: 'credit', closingDay: 28 })
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'Compra closingDay 28',
      totalAmount: '600.00',
      totalInstallments: 3,
      startDate: '2025-01-30',
      categoryId,
      accountId: creditAccount.id,
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) =>
        and(eqFn(g.userId, userId), eqFn(g.name, 'Compra closingDay 28')),
    })
    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })

    // Parcela 1: data real da compra, referenceMonth fevereiro (30 > 28)
    expect(txs[0].date).toBe('2025-01-30')
    expect(txs[0].referenceMonth).toBe('2025-02-01')
    // Parcela 2: dia 29 de fev não existe em 2025 → fallback dia 1 de março
    expect(txs[1].date).toBe('2025-03-01')
    expect(txs[1].referenceMonth).toBe('2025-03-01')
    // Parcela 3: dia 29 de março existe → retorna 29/mar
    expect(txs[2].date).toBe('2025-03-29')
    expect(txs[2].referenceMonth).toBe('2025-04-01')
  })
})

// ─── deleteInstallmentGroup ───────────────────────────────────────────────────

describe('deleteInstallmentGroup', () => {
  it('remove grupo e todas as transações do grupo atomicamente', async () => {
    // Criar via action para ter um cenário realista
    const { createInstallmentPurchase, deleteInstallmentGroup } =
      await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'Sofá para deletar',
      totalAmount: '1200.00',
      totalInstallments: 4,
      startDate: '2025-03-01',
      categoryId,
      accountId,
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) =>
        and(eqFn(g.userId, userId), eqFn(g.name, 'Sofá para deletar')),
    })
    expect(group).toBeDefined()

    const txsBefore = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
    })
    expect(txsBefore).toHaveLength(4)

    vi.mocked(revalidatePath).mockClear()
    await deleteInstallmentGroup(group!.id)

    // Grupo não existe mais
    const deletedGroup = await db.query.installmentGroups.findFirst({
      where: eq(schema.installmentGroups.id, group!.id),
    })
    expect(deletedGroup).toBeUndefined()

    // Transações foram deletadas junto — não ficaram órfãs
    const remainingTxs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
    })
    expect(remainingTxs).toHaveLength(0)

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/panorama')
  })

  it('não afeta transações de outros grupos do mesmo usuário', async () => {
    const { createInstallmentPurchase, deleteInstallmentGroup } =
      await import('@/lib/actions/transactions')

    // Criar dois grupos
    await createInstallmentPurchase({
      name: 'Grupo A',
      totalAmount: '600.00',
      totalInstallments: 2,
      startDate: '2025-04-01',
      categoryId,
      accountId,
    })
    await createInstallmentPurchase({
      name: 'Grupo B',
      totalAmount: '900.00',
      totalInstallments: 3,
      startDate: '2025-04-01',
      categoryId,
      accountId,
    })

    const groupA = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) => and(eqFn(g.userId, userId), eqFn(g.name, 'Grupo A')),
    })
    const groupB = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) => and(eqFn(g.userId, userId), eqFn(g.name, 'Grupo B')),
    })

    await deleteInstallmentGroup(groupA!.id)

    // Transações do Grupo B permanecem intactas
    const txsB = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, groupB!.id),
    })
    expect(txsB).toHaveLength(3)
  })
})

// ─── createTransaction com splits ─────────────────────────────────────────────

describe('createTransaction com splits', () => {
  it('cria a transação e as cobranças de devedor atomicamente', async () => {
    const person2 = await createPerson(db, userId, 'Segunda Pessoa Split')
    const { createTransaction } = await import('@/lib/actions/transactions')

    vi.mocked(revalidatePath).mockClear()
    await createTransaction({
      name: 'Presente da mãe',
      amount: '300.00',
      date: '2025-06-10',
      categoryId,
      accountId,
      splits: [
        { personId, amount: '100.00' },
        { personId: person2.id, amount: '100.00' },
      ],
    })

    const tx = await db.query.transactions.findFirst({
      where: (t, { and, eq: eqFn }) => and(eqFn(t.userId, userId), eqFn(t.name, 'Presente da mãe')),
    })
    expect(tx).toBeDefined()
    expect(tx?.amount).toBe('300.00')

    const charges = await db.query.debtorEntries.findMany({
      where: (e, { and, eq: eqFn }) =>
        and(eqFn(e.sourceTransactionId, tx!.id), eqFn(e.userId, userId)),
      orderBy: (e, { asc }) => asc(e.createdAt),
    })

    expect(charges).toHaveLength(2)
    expect(charges[0].personId).toBe(personId)
    expect(charges[0].amount).toBe('100.00')
    expect(charges[0].type).toBe('charge')
    expect(charges[0].status).toBe('open')
    expect(charges[0].description).toBe('Presente da mãe')
    expect(charges[0].entryDate).toBe('2025-06-10')
    expect(charges[0].referenceMonth).toBe('2025-06-01')
    expect(charges[1].personId).toBe(person2.id)

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/panorama')
  })

  it('não cria cobranças quando splits é omitido', async () => {
    const { createTransaction } = await import('@/lib/actions/transactions')

    await createTransaction({
      name: 'Mercado sem split',
      amount: '150.00',
      date: '2025-06-11',
      categoryId,
      accountId,
    })

    const tx = await db.query.transactions.findFirst({
      where: (t, { and, eq: eqFn }) =>
        and(eqFn(t.userId, userId), eqFn(t.name, 'Mercado sem split')),
    })
    expect(tx).toBeDefined()

    const charges = await db.query.debtorEntries.findMany({
      where: (e, { eq: eqFn }) => eqFn(e.sourceTransactionId, tx!.id),
    })
    expect(charges).toHaveLength(0)
  })

  it('modo integral: registra com o valor da parte do usuário e cobrança com o valor da outra parte', async () => {
    const { createTransaction } = await import('@/lib/actions/transactions')

    // Jantar R$500: usuário paga R$250, parceira deve R$250.
    // Com splitIntegral o form passa amount='250.00' e split de '250.00'.
    await createTransaction({
      name: 'Jantar modo integral',
      amount: '250.00',
      date: '2025-06-15',
      categoryId,
      accountId,
      splits: [{ personId, amount: '250.00' }],
    })

    const tx = await db.query.transactions.findFirst({
      where: (t, { and, eq: eqFn }) =>
        and(eqFn(t.userId, userId), eqFn(t.name, 'Jantar modo integral')),
    })
    expect(tx).toBeDefined()
    expect(tx?.amount).toBe('250.00')

    const charges = await db.query.debtorEntries.findMany({
      where: (e, { eq: eqFn }) => eqFn(e.sourceTransactionId, tx!.id),
    })
    expect(charges).toHaveLength(1)
    expect(charges[0].amount).toBe('250.00')
    expect(charges[0].personId).toBe(personId)
  })

  it('rejeita quando pessoa não pertence ao usuário e não persiste nada', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPerson).mockRejectedValueOnce(new Error('Não autorizado'))

    const countBefore = await db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))

    const { createTransaction } = await import('@/lib/actions/transactions')

    await expect(
      createTransaction({
        name: 'Jantar split inválido',
        amount: '200.00',
        date: '2025-06-10',
        categoryId,
        accountId,
        splits: [{ personId: FOREIGN_UUID, amount: '100.00' }],
      })
    ).rejects.toThrow('Não autorizado')

    const countAfter = await db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))

    expect(countAfter).toHaveLength(countBefore.length)
  })
})

// ─── createInstallmentPurchase com splits ────────────────────────────────────

describe('createInstallmentPurchase com splits', () => {
  it('cria uma cobrança por parcela por pessoa com valor proporcional', async () => {
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'Cadeira split',
      totalAmount: '600.00',
      totalInstallments: 3,
      startDate: '2025-06-01',
      categoryId,
      accountId,
      splits: [{ personId, amount: '300.00' }],
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) => and(eqFn(g.userId, userId), eqFn(g.name, 'Cadeira split')),
    })
    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })
    expect(txs).toHaveLength(3)

    for (let i = 0; i < 3; i++) {
      const charges = await db.query.debtorEntries.findMany({
        where: (e, { and, eq: eqFn }) =>
          and(eqFn(e.sourceTransactionId, txs[i].id), eqFn(e.userId, userId)),
      })
      expect(charges).toHaveLength(1)
      expect(charges[0].personId).toBe(personId)
      expect(charges[0].amount).toBe('100.00') // 300 / 3
      expect(charges[0].description).toBe(`Cadeira split (${i + 1}/3)`)
      expect(charges[0].referenceMonth).toBe(txs[i].referenceMonth)
    }
  })

  it('modo integral: parcelas com o valor da parte do usuário e cobranças proporcionais', async () => {
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    // Compra R$500: usuário paga R$250, parceira deve R$250.
    // Com splitIntegral o form passa totalAmount='250.00' e split de '250.00', 2 parcelas.
    await createInstallmentPurchase({
      name: 'Cadeira modo integral',
      totalAmount: '250.00',
      totalInstallments: 2,
      startDate: '2025-06-01',
      categoryId,
      accountId,
      splits: [{ personId, amount: '250.00' }],
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) =>
        and(eqFn(g.userId, userId), eqFn(g.name, 'Cadeira modo integral')),
    })
    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })
    expect(txs).toHaveLength(2)
    // Cada parcela = 250 / 2 = 125
    expect(txs[0].amount).toBe('125.00')
    expect(txs[1].amount).toBe('125.00')

    for (const tx of txs) {
      const charges = await db.query.debtorEntries.findMany({
        where: (e, { and, eq: eqFn }) =>
          and(eqFn(e.sourceTransactionId, tx.id), eqFn(e.userId, userId)),
      })
      expect(charges).toHaveLength(1)
      expect(charges[0].amount).toBe('125.00') // 250 / 2
      expect(charges[0].personId).toBe(personId)
    }
  })

  it('cria cobranças para múltiplas pessoas em todas as parcelas', async () => {
    const person3 = await createPerson(db, userId, 'Terceira Pessoa Split')
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

    await createInstallmentPurchase({
      name: 'Mesa split 2p',
      totalAmount: '600.00',
      totalInstallments: 2,
      startDate: '2025-07-01',
      categoryId,
      accountId,
      splits: [
        { personId, amount: '200.00' },
        { personId: person3.id, amount: '200.00' },
      ],
    })

    const group = await db.query.installmentGroups.findFirst({
      where: (g, { and, eq: eqFn }) => and(eqFn(g.userId, userId), eqFn(g.name, 'Mesa split 2p')),
    })
    const txs = await db.query.transactions.findMany({
      where: eq(schema.transactions.installmentGroupId, group!.id),
      orderBy: (t, { asc }) => asc(t.installmentNumber),
    })

    // 2 parcelas × 2 pessoas = 4 cobranças total, R$100 cada (200 / 2)
    for (const tx of txs) {
      const charges = await db.query.debtorEntries.findMany({
        where: (e, { and, eq: eqFn }) =>
          and(eqFn(e.sourceTransactionId, tx.id), eqFn(e.userId, userId)),
      })
      expect(charges).toHaveLength(2)
      expect(charges.every((c) => c.amount === '100.00')).toBe(true)
    }
  })
})
