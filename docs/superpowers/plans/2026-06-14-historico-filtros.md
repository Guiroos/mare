# Histórico + Filtros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/historico` com feed unificado de todas as movimentações (transações, gastos fixos, entradas, investimentos, resgates) com filtros por tipo, categoria, conta, busca e intervalo de datas; adicionar filtros client-side na `TransactionList` do dashboard.

**Architecture:** URL params como fonte de verdade dos filtros na `/historico` (Server Component lê searchParams, chama query, passa dados ao Client Component). O Client Component gerencia paginação append-only via Server Action. No dashboard, os filtros são puramente client-side sobre os dados já carregados do mês.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, `@radix-ui/react-dropdown-menu` (já instalado) para os dropdowns multi-select flutuantes, Vitest para testes unitários das funções puras.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `components/ui/multiselect-dropdown.tsx` | Criar | Dropdown flutuante multi-select reutilizável (Radix DropdownMenu) |
| `lib/utils/historico-params.ts` | Criar | Parsing/serialização de URL params do histórico |
| `lib/queries/historico.ts` | Criar | `getHistoricoFeed` — 5 queries paralelas + merge + sort |
| `lib/actions/historico.ts` | Criar | Server Action `fetchMoreHistorico` para paginação |
| `app/(app)/historico/page.tsx` | Criar | Server Component — lê searchParams, chama query |
| `app/(app)/historico/HistoricoFilters.tsx` | Criar | Barra de filtros client-side com URL update |
| `app/(app)/historico/HistoricoClient.tsx` | Criar | Feed, summary cards, paginação append |
| `components/layout/Sidebar.tsx` | Modificar | Adicionar `/historico` em `mainNav` |
| `components/layout/BottomNav.tsx` | Modificar | Adicionar `/historico` em `menuItems` |
| `components/dashboard/TransactionList.tsx` | Modificar | Busca + Conta filter + subtipo chips + link "Ver histórico" |
| `__tests__/unit/historico-params.test.ts` | Criar | Testes de `parseHistoricoParams` e `buildHistoricoUrl` |
| `__tests__/unit/historico-merge.test.ts` | Criar | Testes de `mergeAndSortFeedItems` |

---

## Task 1: MultiselectDropdown component

**Files:**
- Create: `components/ui/multiselect-dropdown.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/ui/multiselect-dropdown.tsx
'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type MultiselectOption = {
  value: string
  label: string
  group?: string
}

type Props = {
  label: string
  options: MultiselectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  className?: string
}

export function MultiselectDropdown({ label, options, selected, onChange, className }: Props) {
  const allValues = options.map((o) => o.value)
  const activeCount = selected.filter((v) => allValues.includes(v)).length
  const isPartial = activeCount > 0 && activeCount < allValues.length

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  // Group options by optional group label
  const groups: { group: string | null; items: MultiselectOption[] }[] = []
  for (const opt of options) {
    const key = opt.group ?? null
    const existing = groups.find((g) => g.group === key)
    if (existing) existing.items.push(opt)
    else groups.push({ group: key, items: [opt] })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption transition-colors duration-fast',
            isPartial
              ? 'border-accent text-accent-text'
              : 'border-border text-text-secondary hover:border-border-strong',
            className
          )}
        >
          {label}
          {isPartial && (
            <span className="rounded-full bg-accent px-1.5 text-label font-bold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-48 rounded-lg border border-border bg-bg-surface p-2 shadow-lg"
          sideOffset={6}
          align="start"
        >
          {groups.map(({ group, items }, gi) => (
            <div key={group ?? '__root'}>
              {gi > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
              {group && (
                <DropdownMenu.Label className="px-2 py-1 text-label uppercase text-text-tertiary">
                  {group}
                </DropdownMenu.Label>
              )}
              {items.map((opt) => (
                <DropdownMenu.CheckboxItem
                  key={opt.value}
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle"
                  onSelect={(e) => e.preventDefault()}
                >
                  <DropdownMenu.ItemIndicator>
                    <span className="block h-3.5 w-3.5 rounded-sm border border-accent bg-accent" />
                  </DropdownMenu.ItemIndicator>
                  <span
                    className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded-sm border',
                      selected.includes(opt.value) ? 'hidden' : 'border-border'
                    )}
                  />
                  {opt.label}
                </DropdownMenu.CheckboxItem>
              ))}
            </div>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <div className="flex justify-between px-2 py-1">
            <button
              onClick={() => onChange([])}
              className="text-caption text-text-tertiary hover:text-text-secondary"
            >
              Limpar
            </button>
            <button
              onClick={() => onChange(allValues)}
              className="text-caption text-accent-text hover:opacity-80"
            >
              Todos
            </button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/multiselect-dropdown.tsx
git commit -m "feat(ui): add MultiselectDropdown component"
```

---

## Task 2: URL param helpers

**Files:**
- Create: `lib/utils/historico-params.ts`
- Test: `__tests__/unit/historico-params.test.ts`

- [ ] **Step 1: Escrever os testes que devem falhar**

```ts
// __tests__/unit/historico-params.test.ts
import { describe, it, expect } from 'vitest'
import { parseHistoricoParams, buildHistoricoUrl, ALL_TIPOS } from '@/lib/utils/historico-params'

describe('parseHistoricoParams', () => {
  it('usa defaults quando sem params', () => {
    const result = parseHistoricoParams({})
    expect(result.tipos).toEqual([...ALL_TIPOS])
    expect(result.categorias).toEqual([])
    expect(result.contas).toEqual([])
    expect(result.q).toBe('')
    expect(result.cursor).toBeNull()
    // de e ate devem ser strings de data válidas
    expect(result.de).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.ate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // de deve ser ~90 dias antes de ate
    const de = new Date(result.de)
    const ate = new Date(result.ate)
    const diffDays = Math.round((ate.getTime() - de.getTime()) / 86400000)
    expect(diffDays).toBe(90)
  })

  it('parseia tipos como array separado por vírgula', () => {
    const result = parseHistoricoParams({ tipos: 'entrada,saida_avulsa' })
    expect(result.tipos).toEqual(['entrada', 'saida_avulsa'])
  })

  it('ignora tipos inválidos', () => {
    const result = parseHistoricoParams({ tipos: 'entrada,tipo_invalido' })
    expect(result.tipos).toEqual(['entrada'])
  })

  it('parseia categorias e contas como arrays', () => {
    const result = parseHistoricoParams({ categorias: 'uuid1,uuid2', contas: 'uuid3' })
    expect(result.categorias).toEqual(['uuid1', 'uuid2'])
    expect(result.contas).toEqual(['uuid3'])
  })

  it('parseia datas explícitas', () => {
    const result = parseHistoricoParams({ de: '2025-01-15', ate: '2025-06-14' })
    expect(result.de).toBe('2025-01-15')
    expect(result.ate).toBe('2025-06-14')
  })

  it('parseia cursor', () => {
    const result = parseHistoricoParams({ cursor: '2025-03-10_uuid-abc' })
    expect(result.cursor).toBe('2025-03-10_uuid-abc')
  })
})

describe('buildHistoricoUrl', () => {
  it('serializa params como query string', () => {
    const url = buildHistoricoUrl({
      de: '2025-01-15',
      ate: '2025-06-14',
      tipos: ['entrada', 'saida_avulsa'],
      categorias: ['uuid1'],
      contas: [],
      q: 'mercado',
      cursor: null,
    })
    expect(url).toContain('de=2025-01-15')
    expect(url).toContain('ate=2025-06-14')
    expect(url).toContain('tipos=entrada%2Csaida_avulsa')
    expect(url).toContain('categorias=uuid1')
    expect(url).not.toContain('contas=')
    expect(url).toContain('q=mercado')
    expect(url).not.toContain('cursor=')
  })

  it('omite tipos quando todos estão selecionados', () => {
    const url = buildHistoricoUrl({
      de: '2025-01-15',
      ate: '2025-06-14',
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    })
    expect(url).not.toContain('tipos=')
  })
})
```

- [ ] **Step 2: Verificar que falham**

```bash
npm test -- historico-params --run
```

Esperado: erro de importação (`Cannot find module '@/lib/utils/historico-params'`).

- [ ] **Step 3: Implementar `lib/utils/historico-params.ts`**

```ts
// lib/utils/historico-params.ts

export const ALL_TIPOS = [
  'saida_avulsa',
  'saida_fixa',
  'saida_parcelada',
  'entrada',
  'investimento',
  'resgate',
] as const

export type TipoKind = (typeof ALL_TIPOS)[number]

export type HistoricoParams = {
  de: string
  ate: string
  tipos: TipoKind[]
  categorias: string[]
  contas: string[]
  q: string
  cursor: string | null
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function ninetyDaysAgoStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

export function parseHistoricoParams(
  searchParams: Record<string, string | string[] | undefined>
): HistoricoParams {
  const raw = (key: string) => {
    const v = searchParams[key]
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
  }

  const tiposRaw = raw('tipos')
  const tipos: TipoKind[] = tiposRaw
    ? (tiposRaw.split(',').filter((t) => (ALL_TIPOS as readonly string[]).includes(t)) as TipoKind[])
    : [...ALL_TIPOS]

  const categoriasRaw = raw('categorias')
  const contasRaw = raw('contas')

  return {
    de: raw('de') ?? ninetyDaysAgoStr(),
    ate: raw('ate') ?? todayStr(),
    tipos,
    categorias: categoriasRaw ? categoriasRaw.split(',').filter(Boolean) : [],
    contas: contasRaw ? contasRaw.split(',').filter(Boolean) : [],
    q: raw('q') ?? '',
    cursor: raw('cursor') ?? null,
  }
}

export function buildHistoricoUrl(params: HistoricoParams): string {
  const p = new URLSearchParams()
  p.set('de', params.de)
  p.set('ate', params.ate)

  const allTiposSelected =
    params.tipos.length === ALL_TIPOS.length && ALL_TIPOS.every((t) => params.tipos.includes(t))
  if (!allTiposSelected && params.tipos.length > 0) p.set('tipos', params.tipos.join(','))

  if (params.categorias.length > 0) p.set('categorias', params.categorias.join(','))
  if (params.contas.length > 0) p.set('contas', params.contas.join(','))
  if (params.q) p.set('q', params.q)
  if (params.cursor) p.set('cursor', params.cursor)

  return `/historico?${p.toString()}`
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npm test -- historico-params --run
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/historico-params.ts __tests__/unit/historico-params.test.ts
git commit -m "feat(utils): add historico URL param helpers"
```

---

## Task 3: Query getHistoricoFeed

**Files:**
- Create: `lib/queries/historico.ts`
- Test: `__tests__/unit/historico-merge.test.ts`

- [ ] **Step 1: Escrever testes para o merge/sort (função pura)**

```ts
// __tests__/unit/historico-merge.test.ts
import { describe, it, expect } from 'vitest'
import { mergeAndSortFeedItems } from '@/lib/queries/historico'
import type { HistoricoFeedItem } from '@/lib/queries/historico'

function makeItem(overrides: Partial<HistoricoFeedItem>): HistoricoFeedItem {
  return {
    id: 'id-1',
    kind: 'saida_avulsa',
    name: 'Item',
    amount: '100.00',
    date: '2025-06-10',
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categoryBgColor: null,
    accountId: null,
    accountName: null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: null,
    ...overrides,
  }
}

describe('mergeAndSortFeedItems', () => {
  it('ordena por data descendente', () => {
    const items = [
      makeItem({ id: 'a', date: '2025-06-01' }),
      makeItem({ id: 'b', date: '2025-06-15' }),
      makeItem({ id: 'c', date: '2025-06-08' }),
    ]
    const result = mergeAndSortFeedItems([items])
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('itens com mesma data mantêm ordem de inserção (stable sort)', () => {
    const items = [
      makeItem({ id: 'x', date: '2025-06-10' }),
      makeItem({ id: 'y', date: '2025-06-10' }),
    ]
    const result = mergeAndSortFeedItems([items])
    expect(result.map((i) => i.id)).toEqual(['x', 'y'])
  })

  it('merge de múltiplos arrays', () => {
    const a = [makeItem({ id: 'a', date: '2025-06-15' })]
    const b = [makeItem({ id: 'b', date: '2025-06-12' })]
    const c = [makeItem({ id: 'c', date: '2025-06-20' })]
    const result = mergeAndSortFeedItems([a, b, c])
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('retorna array vazio para inputs vazios', () => {
    expect(mergeAndSortFeedItems([[], [], []])).toEqual([])
  })
})
```

- [ ] **Step 2: Verificar que os testes falham**

```bash
npm test -- historico-merge --run
```

Esperado: erro de importação.

- [ ] **Step 3: Implementar `lib/queries/historico.ts`**

```ts
// lib/queries/historico.ts
import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  investmentWithdrawals,
  investmentTypes,
  categories,
  paymentAccounts,
} from '@/lib/db/schema'
import { and, eq, between, gte, lte, inArray, ilike, or, isNull } from 'drizzle-orm'
import type { HistoricoParams, TipoKind } from '@/lib/utils/historico-params'

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
function fixedExpenseDate(referenceMonth: string, dueDay: number): string {
  const base = new Date(referenceMonth + 'T12:00:00')
  base.setDate(base.getDate() + dueDay - 1)
  return base.toISOString().slice(0, 10)
}

// Months whose window overlaps the de..ate range (YYYY-MM-01 format)
function referenceMonthsInRange(de: string, ate: string): string[] {
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
      ? and(
          eq(investments.userId, userId),
          inArray(investments.referenceMonth, refMonths),
          contas.length > 0 ? undefined : undefined // investments não têm accountId
        )
      : undefined

  const withdrawWhere = and(
    eq(investmentWithdrawals.userId, userId),
    between(investmentWithdrawals.date, de, ate)
  )

  const [txRows, fxRows, incomeRows, investRows, withdrawRows] = await Promise.all([
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
  ])

  // Map each source to HistoricoFeedItem
  const txItems: HistoricoFeedItem[] = txRows
    .filter((t) => {
      if (t.installmentGroup !== null) return wantsParcelada
      return wantsAvulsa
    })
    .map((t) => ({
      id: t.id,
      kind: t.installmentGroup !== null ? 'saida_parcelada' : ('saida_avulsa' as TipoKind),
      name: t.name,
      amount: t.amount,
      date: t.date,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? null,
      categoryColor: t.category?.color ?? null,
      categoryBgColor: t.category?.bgColor ?? null,
      accountId: t.accountId,
      accountName: t.account?.name ?? null,
      installmentNumber: t.installmentNumber ?? null,
      totalInstallments: t.totalInstallments ?? null,
      investmentTypeName: null,
    }))

  const fxItems: HistoricoFeedItem[] = fxRows.map((f) => ({
    id: f.id,
    kind: 'saida_fixa',
    name: f.name,
    amount: f.amount,
    date: fixedExpenseDate(f.referenceMonth, f.dueDay),
    categoryId: f.categoryId,
    categoryName: f.category?.name ?? null,
    categoryColor: f.category?.color ?? null,
    categoryBgColor: f.category?.bgColor ?? null,
    accountId: f.accountId,
    accountName: f.account?.name ?? null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: null,
  }))

  const incomeItems: HistoricoFeedItem[] = incomeRows.map((i) => ({
    id: i.id,
    kind: 'entrada',
    name: i.source,
    amount: i.amount,
    date: i.referenceMonth, // primeiro dia do mês como data de exibição
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
    .map((inv) => ({
      id: inv.id,
      kind: 'investimento',
      name: inv.investmentType.name,
      amount: inv.amount!,
      date: inv.referenceMonth,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      categoryBgColor: null,
      accountId: null,
      accountName: null,
      installmentNumber: null,
      totalInstallments: null,
      investmentTypeName: inv.investmentType.name,
    }))

  const withdrawItems: HistoricoFeedItem[] = withdrawRows.map((w) => ({
    id: w.id,
    kind: 'resgate',
    name: w.investmentType.name,
    amount: w.amount,
    date: w.date,
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categoryBgColor: null,
    accountId: null,
    accountName: null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: w.investmentType.name,
  }))

  // Filtro JS de precisão para fixedExpenses (dueDay pode cair fora do range mesmo com referenceMonth dentro)
  const fxItemsFiltered = fxItems.filter((f) => f.date >= de && f.date <= ate)

  // Merge and sort
  const sorted = mergeAndSortFeedItems([txItems, fxItemsFiltered, incomeItems, investItems, withdrawItems])

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
```

- [ ] **Step 4: Rodar testes de merge**

```bash
npm test -- historico-merge --run
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/historico.ts __tests__/unit/historico-merge.test.ts
git commit -m "feat(queries): add getHistoricoFeed with merge/sort and pagination"
```

---

## Task 4: Server Action de paginação

**Files:**
- Create: `lib/actions/historico.ts`

- [ ] **Step 1: Criar Server Action**

```ts
// lib/actions/historico.ts
'use server'

import { requireUserId } from '@/lib/auth/require-user'
import { getHistoricoFeed } from '@/lib/queries/historico'
import type { HistoricoParams } from '@/lib/utils/historico-params'

export async function fetchMoreHistorico(params: HistoricoParams) {
  const userId = await requireUserId()
  return getHistoricoFeed(userId, params)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/historico.ts
git commit -m "feat(actions): add fetchMoreHistorico server action"
```

---

## Task 5: Sidebar e BottomNav

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/BottomNav.tsx`

> **Atenção:** Usar `Write` (não `Edit`) em cada arquivo para evitar múltiplas interrupções do hook ds-reviewer. Ler o arquivo completo antes de reescrever.

- [ ] **Step 1: Adicionar `/historico` ao `mainNav` da Sidebar**

Em `components/layout/Sidebar.tsx`, adicionar `History` aos imports do lucide-react e inserir o item no array `mainNav`:

```ts
// Adicionar ao import de lucide-react:
History,

// Inserir após '/dashboard' no mainNav:
{ href: '/historico', label: 'Histórico', icon: History },
```

Usar `Write` com o arquivo completo reescrito (ler primeiro com `Read`).

- [ ] **Step 2: Adicionar `/historico` ao `menuItems` do BottomNav**

Em `components/layout/BottomNav.tsx`, adicionar `History` aos imports do lucide-react e inserir no array `menuItems`:

```ts
// Adicionar ao import de lucide-react:
History,

// Inserir como primeiro item do menuItems:
{ href: '/historico', label: 'Histórico', icon: History },
```

Usar `Write` com o arquivo completo reescrito.

- [ ] **Step 3: Verificar que a rota existe e não quebra o build**

```bash
npm run typecheck 2>&1 | head -20
```

Esperado: sem erros relacionados a Sidebar ou BottomNav.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/BottomNav.tsx
git commit -m "feat(nav): add /historico to sidebar and bottom nav"
```

---

## Task 6: HistoricoFilters component

**Files:**
- Create: `app/(app)/historico/HistoricoFilters.tsx`

- [ ] **Step 1: Criar o componente de filtros**

```tsx
// app/(app)/historico/HistoricoFilters.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { MultiselectDropdown } from '@/components/ui/multiselect-dropdown'
import { Input } from '@/components/ui/input'
import { buildHistoricoUrl, parseHistoricoParams, ALL_TIPOS } from '@/lib/utils/historico-params'
import type { HistoricoParams, TipoKind } from '@/lib/utils/historico-params'
import { cn } from '@/lib/utils/cn'

const TIPO_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida_avulsa', label: 'Avulsa', group: 'Saídas' },
  { value: 'saida_fixa', label: 'Fixa', group: 'Saídas' },
  { value: 'saida_parcelada', label: 'Parcelada', group: 'Saídas' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'resgate', label: 'Resgate' },
]

type CategoryOption = { value: string; label: string }
type AccountOption = { value: string; label: string }

type Props = {
  params: HistoricoParams
  categoryOptions: CategoryOption[]
  accountOptions: AccountOption[]
}

export function HistoricoFilters({ params, categoryOptions, accountOptions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localQ, setLocalQ] = useState(params.q)

  const navigate = useCallback(
    (next: Partial<HistoricoParams>) => {
      const url = buildHistoricoUrl({ ...params, ...next, cursor: null })
      startTransition(() => router.push(url))
    },
    [params, router]
  )

  const hasActiveFilters =
    params.tipos.length !== ALL_TIPOS.length ||
    params.categorias.length > 0 ||
    params.contas.length > 0 ||
    params.q !== ''

  // Debounce busca por texto — navega 400ms após parar de digitar
  let searchTimeout: ReturnType<typeof setTimeout>
  const handleSearchChange = (value: string) => {
    setLocalQ(value)
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => navigate({ q: value }), 400)
  }

  return (
    <div className={cn('space-y-2', isPending && 'opacity-60 transition-opacity')}>
      {/* Linha 1: datas + busca */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-input px-3 py-2">
          <span className="text-caption text-text-tertiary">De</span>
          <input
            type="date"
            value={params.de}
            onChange={(e) => navigate({ de: e.target.value })}
            className="bg-transparent text-small text-text-primary outline-none"
          />
        </div>
        <span className="text-text-tertiary">→</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-input px-3 py-2">
          <span className="text-caption text-text-tertiary">Até</span>
          <input
            type="date"
            value={params.ate}
            onChange={(e) => navigate({ ate: e.target.value })}
            className="bg-transparent text-small text-text-primary outline-none"
          />
        </div>
        <Input
          placeholder="Buscar por descrição..."
          value={localQ}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="min-w-40 flex-1"
        />
      </div>

      {/* Linha 2: filtros de tipo, categoria, conta */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiselectDropdown
          label="Tipo"
          options={TIPO_OPTIONS}
          selected={params.tipos}
          onChange={(next) => navigate({ tipos: next as TipoKind[] })}
        />
        {categoryOptions.length > 0 && (
          <MultiselectDropdown
            label="Categoria"
            options={categoryOptions}
            selected={params.categorias}
            onChange={(next) => navigate({ categorias: next })}
          />
        )}
        {accountOptions.length > 0 && (
          <MultiselectDropdown
            label="Conta"
            options={accountOptions}
            selected={params.contas}
            onChange={(next) => navigate({ contas: next })}
          />
        )}
        {hasActiveFilters && (
          <button
            onClick={() =>
              navigate({
                tipos: [...ALL_TIPOS],
                categorias: [],
                contas: [],
                q: '',
              })
            }
            className="ml-auto text-caption text-negative hover:opacity-80"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/historico/HistoricoFilters.tsx
git commit -m "feat(historico): add HistoricoFilters component"
```

---

## Task 7: HistoricoClient + feed

**Files:**
- Create: `app/(app)/historico/HistoricoClient.tsx`

- [ ] **Step 1: Criar o Client Component**

```tsx
// app/(app)/historico/HistoricoClient.tsx
'use client'

import { useState, useTransition, Fragment } from 'react'
import { fetchMoreHistorico } from '@/lib/actions/historico'
import { TxList, TxGroupHeader } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { toAmount, formatCurrency } from '@/lib/utils/currency'
import { formatDisplayDate, daysAgo, parseDate } from '@/lib/utils/date'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'
import type { HistoricoFeedItem } from '@/lib/queries/historico'
import type { HistoricoParams, TipoKind } from '@/lib/utils/historico-params'

const KIND_LABEL: Record<TipoKind, string> = {
  saida_avulsa: 'Avulsa',
  saida_fixa: 'Fixa',
  saida_parcelada: 'Parcelada',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

const KIND_BADGE_CLASS: Record<TipoKind, string> = {
  saida_avulsa: 'bg-negative-subtle text-negative-text',
  saida_fixa: 'bg-warning-subtle text-warning-text',
  saida_parcelada: 'bg-negative-subtle text-negative-text',
  entrada: 'bg-positive-subtle text-positive-text',
  investimento: 'bg-accent-subtle text-accent-text',
  resgate: 'bg-positive-subtle text-positive-text',
}

function isDebit(kind: TipoKind) {
  return kind === 'saida_avulsa' || kind === 'saida_fixa' || kind === 'saida_parcelada'
}

function formatGroupDate(dateStr: string): string {
  const diff = daysAgo(dateStr)
  const dayMonth = formatDisplayDate(dateStr)
  if (diff === 0) return `Hoje, ${dayMonth}`
  if (diff === 1) return `Ontem, ${dayMonth}`
  return `${format(parseDate(dateStr), "EEE'.'", { locale: ptBR })}, ${dayMonth}`
}

function groupByDate(items: HistoricoFeedItem[]) {
  return items.reduce<{ date: string; items: HistoricoFeedItem[] }[]>((acc, item) => {
    const last = acc.at(-1)
    if (last?.date === item.date) last.items.push(item)
    else acc.push({ date: item.date, items: [item] })
    return acc
  }, [])
}

function SummaryCards({ items }: { items: HistoricoFeedItem[] }) {
  let entradas = 0
  let saidas = 0
  let investido = 0

  for (const item of items) {
    const amt = toAmount(item.amount)
    if (item.kind === 'entrada') entradas += amt
    else if (isDebit(item.kind)) saidas += amt
    else if (item.kind === 'investimento') investido += amt
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg bg-positive-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-positive-text">
          {formatCurrency(entradas)}
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">entradas</p>
      </div>
      <div className="rounded-lg bg-negative-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-negative-text">
          {formatCurrency(saidas)}
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">saídas</p>
      </div>
      <div className="rounded-lg bg-accent-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-accent-text">
          {formatCurrency(investido)}
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">investido</p>
      </div>
      <div className="rounded-lg border border-border bg-bg-surface p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-text-primary">{items.length}</p>
        <p className="mt-0.5 text-caption text-text-tertiary">itens</p>
      </div>
    </div>
  )
}

function FeedRow({ item }: { item: HistoricoFeedItem }) {
  const initial = item.name.slice(0, 1).toUpperCase()
  const debit = isDebit(item.kind)

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-bg-subtle">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-bg-subtle text-small font-semibold text-text-secondary"
        style={
          item.categoryBgColor || item.categoryColor
            ? { background: item.categoryBgColor ?? undefined, color: item.categoryColor ?? undefined }
            : undefined
        }
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{item.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {item.categoryName && (
            <>
              {item.categoryColor && (
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: item.categoryColor }}
                />
              )}
              <span className="flex-shrink-0 text-caption font-medium text-text-secondary">
                {item.categoryName}
              </span>
            </>
          )}
          {item.accountName && (
            <>
              <span className="flex-shrink-0 text-caption text-text-tertiary">·</span>
              <span className="truncate text-caption text-text-tertiary">{item.accountName}</span>
            </>
          )}
          {item.installmentNumber && item.totalInstallments && (
            <span className="ml-1 flex-shrink-0 rounded-sm border border-border bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
              {item.installmentNumber}/{item.totalInstallments}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'flex-shrink-0 rounded-sm px-1.5 py-0.5 text-label font-semibold',
          KIND_BADGE_CLASS[item.kind]
        )}
      >
        {KIND_LABEL[item.kind]}
      </span>

      <span
        className={cn(
          'flex-shrink-0 text-body font-semibold tabular-nums',
          debit ? 'text-negative-text' : item.kind === 'entrada' ? 'text-positive-text' : 'text-accent-text'
        )}
      >
        {debit ? '−' : '+'} {formatCurrency(toAmount(item.amount))}
      </span>
    </div>
  )
}

type Props = {
  initialItems: HistoricoFeedItem[]
  initialHasMore: boolean
  initialNextCursor: string | null
  params: HistoricoParams
}

export function HistoricoClient({ initialItems, initialHasMore, initialNextCursor, params }: Props) {
  const [items, setItems] = useState(initialItems)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [isPending, startTransition] = useTransition()

  const loadMore = () => {
    if (!cursor) return
    startTransition(async () => {
      const result = await fetchMoreHistorico({ ...params, cursor })
      setItems((prev) => [...prev, ...result.items])
      setHasMore(result.hasMore)
      setCursor(result.nextCursor)
    })
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhuma movimentação encontrada"
        description="Tente ajustar o período ou os filtros."
      />
    )
  }

  const groups = groupByDate(items)

  return (
    <div className="space-y-4">
      <SummaryCards items={items} />

      <TxList>
        {groups.map(({ date, items: groupItems }) => (
          <Fragment key={date}>
            <TxGroupHeader
              date={formatGroupDate(date)}
              total={`${formatCurrency(groupItems.filter((i) => isDebit(i.kind)).reduce((s, i) => s + toAmount(i.amount), 0))} saídas`}
            />
            {groupItems.map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </Fragment>
        ))}
      </TxList>

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={loadMore} disabled={isPending}>
            {isPending ? 'Carregando...' : `Carregar mais`}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/historico/HistoricoClient.tsx
git commit -m "feat(historico): add HistoricoClient with feed and load-more pagination"
```

---

## Task 8: Página /historico (Server Component)

**Files:**
- Create: `app/(app)/historico/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
// app/(app)/historico/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'
import { parseHistoricoParams } from '@/lib/utils/historico-params'
import { getHistoricoFeed } from '@/lib/queries/historico'
import { db } from '@/lib/db'
import { categoryGroups, categories, paymentAccounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { HistoricoFilters } from './HistoricoFilters'
import { HistoricoClient } from './HistoricoClient'

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const userId = session.user.id

  const rawParams = await searchParams
  const params = parseHistoricoParams(rawParams)

  const [feedResult, groupsData, accountsData] = await Promise.all([
    getHistoricoFeed(userId, params),
    db.query.categoryGroups.findMany({
      where: eq(categoryGroups.userId, userId),
      with: { categories: true },
    }),
    db.query.paymentAccounts.findMany({
      where: eq(paymentAccounts.userId, userId),
    }),
  ])

  const categoryOptions = groupsData.flatMap((g) =>
    g.categories.map((c) => ({ value: c.id, label: c.name }))
  )
  const accountOptions = accountsData.map((a) => ({ value: a.id, label: a.name }))

  return (
    <PageLayout>
      <PageHeader title="Histórico" description="Todas as movimentações" />
      <HistoricoFilters
        params={params}
        categoryOptions={categoryOptions}
        accountOptions={accountOptions}
      />
      <HistoricoClient
        initialItems={feedResult.items}
        initialHasMore={feedResult.hasMore}
        initialNextCursor={feedResult.nextCursor}
        params={params}
      />
    </PageLayout>
  )
}
```

- [ ] **Step 2: Rodar typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

Esperado: sem erros em arquivos do histórico.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/historico/page.tsx
git commit -m "feat(historico): add /historico page with server-side filtering"
```

---

## Task 9: Dashboard TransactionList — filtros + link

**Files:**
- Modify: `components/dashboard/TransactionList.tsx`

> Usar `Write` com o arquivo completo (não `Edit`) para evitar múltiplas interrupções do hook.

- [ ] **Step 1: Ler o arquivo atual completo**

```bash
cat -n components/dashboard/TransactionList.tsx
```

- [ ] **Step 2: Reescrever com as adições**

As mudanças no arquivo são:

**a) Adicionar imports:**
```tsx
import { Input } from '@/components/ui/input'
import { MultiselectDropdown } from '@/components/ui/multiselect-dropdown'
import Link from 'next/link'
import { buildHistoricoUrl } from '@/lib/utils/historico-params'
import { currentYearMonth } from '@/lib/utils/date'
```

**b) Adicionar props `monthYearMonth` e `creditAccountIds` ao tipo de `TransactionList`:**
```tsx
// já existe creditAccountIds — adicionar:
yearMonth?: string  // para o link "Ver histórico"
```

**c) Adicionar estado de filtros client-side no `TransactionList`:**
```tsx
const [search, setSearch] = useState('')
const [selectedContas, setSelectedContas] = useState<string[]>([])
const [selectedSubtipos, setSelectedSubtipos] = useState<('avulsa' | 'parcelada')[]>(['avulsa', 'parcelada'])
```

**d) Aplicar filtros antes de renderizar:**
```tsx
const filtered = transactions.filter((t) => {
  if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
  if (selectedContas.length > 0 && t.accountId && !selectedContas.includes(t.accountId)) return false
  const subtype = t.installmentGroup !== null ? 'parcelada' : 'avulsa'
  if (!selectedSubtipos.includes(subtype)) return false
  return true
})
```

**e) Substituir o header da `TxList` por novo header com filtros (Opção A — 2 linhas):**
```tsx
{/* Header com link para histórico */}
<div className="flex items-center justify-between border-b border-border px-4 py-3">
  <span className="text-body font-semibold text-text-primary">Transações</span>
  <Link
    href={buildHistoricoUrl({
      de: `${yearMonth ?? currentYearMonth()}-01`,
      ate: `${yearMonth ?? currentYearMonth()}-31`,
      tipos: ['saida_avulsa', 'saida_parcelada'],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    })}
    className="text-caption text-accent-text hover:opacity-80"
  >
    Ver histórico →
  </Link>
</div>

{/* Linha 1: busca + conta */}
<div className="flex gap-2 border-b border-border px-4 py-2">
  <Input
    placeholder="Buscar..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="h-8 flex-1 text-small"
  />
  {accountOptions.length > 0 && (
    <MultiselectDropdown
      label="Conta"
      options={accountOptions}
      selected={selectedContas}
      onChange={(v) => setSelectedContas(v)}
    />
  )}
</div>

{/* Linha 2: subtipo + agrupamento */}
<div className="flex gap-2 border-b border-border px-4 py-2">
  {(['avulsa', 'parcelada'] as const).map((sub) => (
    <Chip
      key={sub}
      active={selectedSubtipos.includes(sub)}
      onClick={() =>
        setSelectedSubtipos((prev) =>
          prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
        )
      }
    >
      {sub === 'avulsa' ? 'Avulsas' : 'Parceladas'}
    </Chip>
  ))}
  <div className="mx-1 w-px self-stretch bg-border" />
  {(['date', 'account', 'type'] as const).map((mode) => (
    <Chip key={mode} active={groupBy === mode} onClick={() => handleGroupBy(mode)}>
      {CHIP_LABELS[mode]}
    </Chip>
  ))}
</div>
```

**f) Passar `filtered` em vez de `transactions` para as views:**
```tsx
// Mudar todas as referências de transactions para filtered nos views
// DateGroupedView, AccountGroupedView, TypeGroupedView
```

**g) Adicionar badge de subtipo em cada `TransactionRow`** (após o amount):
```tsx
<span className="flex-shrink-0 rounded-sm bg-bg-subtle px-1.5 py-0.5 text-label text-text-tertiary">
  {t.installmentGroup !== null ? 'Parcelada' : 'Avulsa'}
</span>
```

**h) Atualizar o tipo de props de `TransactionList` para incluir `accountOptions` e `yearMonth`:**
```tsx
// Adicionar ao tipo Props do TransactionList:
accountOptions?: { value: string; label: string }[]
yearMonth?: string
```

**i) Adicionar `accountOptions` como prop calculada no componente pai (dashboard page)** — derivada de `data.transactions` com accounts únicas:
```tsx
// Em dashboard/page.tsx, passar para TransactionList:
const accountOptions = [...new Map(
  data.transactions.filter(t => t.account).map(t => [t.accountId, { value: t.accountId!, label: t.account!.name }])
).values()]

<TransactionList
  transactions={data.transactions}
  creditAccountIds={creditAccountIds}
  yearMonth={yearMonth}
  accountOptions={accountOptions}
/>
```

Usar `Write` com o arquivo completo `components/dashboard/TransactionList.tsx` incorporando todos esses pontos.

- [ ] **Step 3: Rodar typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

Corrigir erros de tipo se houver.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/TransactionList.tsx app/(app)/dashboard/page.tsx
git commit -m "feat(dashboard): add search, account filter, subtype chips and historico link to TransactionList"
```

---

## Task 10: Verificação final

- [ ] **Step 1: Rodar suite completa**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```

Esperado: sem erros ou warnings.

- [ ] **Step 2: Rodar ds-reviewer nos novos componentes**

```bash
# Invocar ds-reviewer com todos os arquivos novos de uma vez:
# components/ui/multiselect-dropdown.tsx
# app/(app)/historico/HistoricoFilters.tsx
# app/(app)/historico/HistoricoClient.tsx
```

Usar o agente `ds-reviewer` uma única vez com todos os arquivos.

- [ ] **Step 3: Testar manualmente com Playwright MCP**

Sequência mínima:
1. Navegar para `/historico` — verificar que a página carrega com o feed do período default (últimos 90 dias)
2. Abrir dropdown "Tipo" — verificar que é flutuante (não empurra conteúdo), verificar grupos (Saídas: Avulsa / Fixa / Parcelada)
3. Desmarcar "Entrada" — verificar que os summary cards atualizam e entradas somem do feed
4. Usar campo de data "De" para restringir o período — verificar reload da lista
5. Usar campo de busca — verificar que a lista filtra após ~400ms
6. Clicar "Limpar filtros" — verificar reset
7. Clicar "Carregar mais" (se disponível) — verificar que itens são appendados sem reload
8. No dashboard, verificar "Ver histórico →" no header de transações
9. No dashboard, usar busca inline e filtro de subtipo

- [ ] **Step 4: Commit final se houver ajustes do ds-reviewer**

```bash
git add -A
git commit -m "fix(historico): apply ds-reviewer feedback"
```
