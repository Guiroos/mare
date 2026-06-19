// lib/queries/historico.ts
import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  investmentWithdrawals,
} from '@/lib/db/schema'
import { and, eq, between, inArray, ilike } from 'drizzle-orm'
import type { HistoricoParams, TipoKind } from '@/lib/utils/historico-params'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField } from '@/lib/crypto/fields'

export type HistoricoFeedItem = {
  id: string
  kind: TipoKind
  name: string
  amount: string
  date: string
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryBgColor: string | null
  accountId: string | null
  accountName: string | null
  installmentNumber: number | null
  totalInstallments: number | null
  investmentTypeName: string | null
}

const PAGE_SIZE = 50

export function mergeAndSortFeedItems(arrays: HistoricoFeedItem[][]): HistoricoFeedItem[] {
  const all = arrays.flat()
  return all.sort((a, b) => {
    if (b.date > a.date) return 1
    if (b.date < a.date) return -1
    return 0
  })
}

// Computa a data de exibição de um gasto fixo: referenceMonth + (dueDay - 1) dias
export function fixedExpenseDate(referenceMonth: string, dueDay: number): string {
  const base = new Date(referenceMonth + 'T12:00:00')
  base.setDate(base.getDate() + dueDay - 1)
  return base.toISOString().slice(0, 10)
}

// Months whose window overlaps the de..ate range (YYYY-MM-01 format)
export function referenceMonthsInRange(de: string, ate: string): string[] {
  const result: string[] = []
  const start = new Date(de.slice(0, 7) + '-01T12:00:00')
  const end = new Date(ate.slice(0, 7) + '-01T12:00:00')
  const cur = new Date(start)
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10))
    cur.setMonth(cur.getMonth() + 1)
  }
  return result
}

export async function getHistoricoFeed(
  userId: string,
  params: HistoricoParams
): Promise<{ items: HistoricoFeedItem[]; hasMore: boolean; nextCursor: string | null }> {
  const { de, ate, tipos, categorias, contas, q } = params

  const wantsAvulsa = tipos.includes('saida_avulsa')
  const wantsParcelada = tipos.includes('saida_parcelada')
  const wantsFixa = tipos.includes('saida_fixa')
  const wantsEntrada = tipos.includes('entrada')
  const wantsInvestimento = tipos.includes('investimento')
  const wantsResgate = tipos.includes('resgate')

  const refMonths = referenceMonthsInRange(de, ate)

  // Build WHERE clauses for each table
  const txBaseWhere = and(
    eq(transactions.userId, userId),
    between(transactions.date, de, ate),
    categorias.length > 0 ? inArray(transactions.categoryId, categorias) : undefined,
    contas.length > 0 ? inArray(transactions.accountId, contas) : undefined,
    q ? ilike(transactions.name, `%${q}%`) : undefined
  )

  const fxWhere =
    refMonths.length > 0
      ? and(
          eq(fixedExpenses.userId, userId),
          inArray(fixedExpenses.referenceMonth, refMonths),
          categorias.length > 0 ? inArray(fixedExpenses.categoryId, categorias) : undefined,
          contas.length > 0 ? inArray(fixedExpenses.accountId, contas) : undefined,
          q ? ilike(fixedExpenses.name, `%${q}%`) : undefined
        )
      : undefined

  const incomesWhere =
    refMonths.length > 0
      ? and(
          eq(incomes.userId, userId),
          inArray(incomes.referenceMonth, refMonths),
          q ? ilike(incomes.source, `%${q}%`) : undefined
        )
      : undefined

  const investWhere =
    refMonths.length > 0
      ? and(eq(investments.userId, userId), inArray(investments.referenceMonth, refMonths))
      : undefined

  const withdrawWhere = and(
    eq(investmentWithdrawals.userId, userId),
    between(investmentWithdrawals.date, de, ate)
  )

  const [dek, [txRows, fxRows, incomeRows, investRows, withdrawRows]] = await Promise.all([
    getDekForUser(userId),
    Promise.all([
      wantsAvulsa || wantsParcelada
        ? db.query.transactions.findMany({
            where: txBaseWhere,
            with: {
              category: true,
              account: true,
              installmentGroup: true,
            },
            orderBy: (t, { desc }) => [desc(t.date)],
          })
        : Promise.resolve([]),

      wantsFixa && fxWhere
        ? db.query.fixedExpenses.findMany({
            where: fxWhere,
            with: { category: true, account: true },
          })
        : Promise.resolve([]),

      wantsEntrada && incomesWhere
        ? db.query.incomes.findMany({ where: incomesWhere })
        : Promise.resolve([]),

      wantsInvestimento && investWhere
        ? db.query.investments.findMany({
            where: investWhere,
            with: { investmentType: true },
          })
        : Promise.resolve([]),

      wantsResgate
        ? db.query.investmentWithdrawals.findMany({
            where: withdrawWhere,
            with: { investmentType: true },
          })
        : Promise.resolve([]),
    ]),
  ])

  // Map each source to HistoricoFeedItem
  const txItems: HistoricoFeedItem[] = txRows
    .filter((t) => {
      if (t.installmentGroup !== null) return wantsParcelada
      return wantsAvulsa
    })
    .map((t) => ({
      id: t.id,
      kind: (t.installmentGroup !== null ? 'saida_parcelada' : 'saida_avulsa') as TipoKind,
      name: decryptField(t.name, dek),
      amount: decryptField(t.amount, dek),
      date: t.date,
      categoryId: t.categoryId,
      categoryName: t.category ? decryptField(t.category.name, dek) : null,
      categoryColor: t.category?.color ?? null,
      categoryBgColor: t.category?.bgColor ?? null,
      accountId: t.accountId,
      accountName: t.account ? decryptField(t.account.name, dek) : null,
      installmentNumber: t.installmentNumber ?? null,
      totalInstallments: t.totalInstallments ?? null,
      investmentTypeName: null,
    }))

  const fxItems: HistoricoFeedItem[] = fxRows.map((f) => ({
    id: f.id,
    kind: 'saida_fixa' as TipoKind,
    name: decryptField(f.name, dek),
    amount: decryptField(f.amount, dek),
    date: fixedExpenseDate(f.referenceMonth, f.dueDay),
    categoryId: f.categoryId,
    categoryName: f.category ? decryptField(f.category.name, dek) : null,
    categoryColor: f.category?.color ?? null,
    categoryBgColor: f.category?.bgColor ?? null,
    accountId: f.accountId,
    accountName: f.account ? decryptField(f.account.name, dek) : null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: null,
  }))

  const incomeItems: HistoricoFeedItem[] = incomeRows.map((i) => ({
    id: i.id,
    kind: 'entrada' as TipoKind,
    name: decryptField(i.source, dek),
    amount: decryptField(i.amount, dek),
    date: i.referenceMonth,
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categoryBgColor: null,
    accountId: null,
    accountName: null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: null,
  }))

  const investItems: HistoricoFeedItem[] = investRows
    .filter((inv) => inv.amount !== null)
    .map((inv) => {
      const typeName = decryptField(inv.investmentType.name, dek)
      return {
        id: inv.id,
        kind: 'investimento' as TipoKind,
        name: typeName,
        amount: decryptField(inv.amount!, dek),
        date: inv.referenceMonth,
        categoryId: null,
        categoryName: null,
        categoryColor: null,
        categoryBgColor: null,
        accountId: null,
        accountName: null,
        installmentNumber: null,
        totalInstallments: null,
        investmentTypeName: typeName,
      }
    })

  const withdrawItems: HistoricoFeedItem[] = withdrawRows.map((w) => {
    const typeName = decryptField(w.investmentType.name, dek)
    return {
      id: w.id,
      kind: 'resgate' as TipoKind,
      name: typeName,
      amount: decryptField(w.amount, dek),
      date: w.date,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      categoryBgColor: null,
      accountId: null,
      accountName: null,
      installmentNumber: null,
      totalInstallments: null,
      investmentTypeName: typeName,
    }
  })

  // Filtro JS de precisão para fixedExpenses (dueDay pode colocar fora do range)
  const fxItemsFiltered = fxItems.filter((f) => f.date >= de && f.date <= ate)

  // Merge and sort
  const merged = mergeAndSortFeedItems([
    txItems,
    fxItemsFiltered,
    incomeItems,
    investItems,
    withdrawItems,
  ])

  // Apply q filter to investment/withdrawal items not filtered at DB level
  const qLower = q ? q.toLowerCase() : null
  const sorted = qLower ? merged.filter((item) => item.name.toLowerCase().includes(qLower)) : merged

  // Cursor-based pagination
  let startIdx = 0
  if (params.cursor) {
    const [cursorDate, cursorId] = params.cursor.split('_')
    const idx = sorted.findIndex((item) => item.date === cursorDate && item.id === cursorId)
    if (idx !== -1) startIdx = idx + 1
  }

  const page = sorted.slice(startIdx, startIdx + PAGE_SIZE)
  const hasMore = startIdx + PAGE_SIZE < sorted.length
  const last = page.at(-1)
  const nextCursor = hasMore && last ? `${last.date}_${last.id}` : null

  return { items: page, hasMore, nextCursor }
}

export type HistoricoFeedResult = Awaited<ReturnType<typeof getHistoricoFeed>>
