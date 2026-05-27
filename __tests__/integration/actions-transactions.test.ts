import { vi, describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createCategoryGroup, createCategory, createAccount } from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsCategory: vi.fn(),
  assertOwnsPaymentAccount: vi.fn(),
}))

neonTestingSetup()

let db: TestDb
let userId: string
let categoryId: string
let accountId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-transactions-${Date.now()}`))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
  ;({ id: accountId } = await createAccount(db, userId))

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const { assertOwnsCategory, assertOwnsPaymentAccount } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsCategory).mockResolvedValue(undefined)
  vi.mocked(assertOwnsPaymentAccount).mockResolvedValue(undefined)
})

// ─── createInstallmentPurchase ────────────────────────────────────────────────

describe('createInstallmentPurchase', () => {
  it('cria o grupo e N transações com nomes, valores e referenceMonth corretos', async () => {
    const { createInstallmentPurchase } = await import('@/lib/actions/transactions')

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
        categoryId: 'id-de-outro-usuario',
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
        accountId: 'id-de-outro-usuario',
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
