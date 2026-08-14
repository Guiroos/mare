# Exportação Completa da Conta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma ação "Baixar todos os meus dados" no `SettingsDialog` que exporta a conta inteira em 12 planilhas, como `.xlsx` multi-aba ou `.zip` de CSVs.

**Architecture:** Um coletor único (`collectFullExport`) roda as queries e devolve `ExportSheet[]`. Os dois formatos consomem o mesmo array: `sheetToCsv` por planilha vira arquivo do ZIP, e o array inteiro vira as abas do `writeXlsxFile`. Nenhuma regra de domínio duplicada entre formatos.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), Drizzle + Neon Postgres, `write-excel-file@4.1.1`, `fflate@0.8.3`, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-13-exportacao-completa-design.md`

## Global Constraints

- **Versões fixas, sem caret.** Instalar sempre com `--save-exact`. `fflate@0.8.3`.
- **Nenhum builder de export toca `db.query.*` direto.** Todo dado vem de uma função de `lib/queries/`, que já decripta via `getDekForUser` + `decryptField`/`decryptOptional`.
- **Preferir `.select()` explícito com `innerJoin` nas queries novas**, não `db.query.*` com `with: {}`. `.claude/crypto.md` documenta que o relational query builder do Drizzle devolve array vazio em silêncio quando a tabela relacionada tem colunas cifradas.
- **`toAmount(val)`** de `lib/utils/currency.ts` para todo campo `decimal` — nunca `Number(x.amount)`.
- **Tipos de retorno exportados** logo após cada query nova: `export type X = Awaited<ReturnType<typeof fn>>[number]` (convenção de `.claude/db.md`).
- **`import { type X }` é proibido** — importar sem o modifier `type` (falso positivo de ESLint com `--max-warnings 0`).
- **Gate antes de cada commit:** `npm run lint && npm run format:check && npm run typecheck && npm test`.
- **Sem valores arbitrários de Tailwind** na Task 12 — só tokens do DS (`.claude/ds-components.md`).
- Testes de integração exigem `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID`, `ENCRYPTION_MASTER_KEY` em `.env.local`. Rodam com `npm run test:integration`.

---

### Task 1: Container ZIP sobre `fflate`

**Files:**
- Modify: `package.json` (dependência nova)
- Create: `lib/export/zip.ts`
- Test: `__tests__/unit/export-zip.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ZipEntry { name: string; content: string }`, `createZip(entries: ZipEntry[]): Buffer`, `toZipResponse(buffer: Buffer, filename: string): Response`.

- [ ] **Step 1: Declarar a dependência**

O `fflate` já está na árvore como dependência transitiva do `write-excel-file` — este passo só o promove a direta. Nenhum download novo.

```bash
npm install --save-exact fflate@0.8.3
```

Confirmar que virou dependência direta:

```bash
node -e "console.log(require('./package.json').dependencies.fflate)"
```

Esperado: `0.8.3` (sem `^`).

- [ ] **Step 2: Escrever os testes que falham**

Criar `__tests__/unit/export-zip.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { createZip } from '@/lib/export/zip'

describe('createZip', () => {
  it('faz round-trip de nomes e conteúdo', () => {
    const buffer = createZip([
      { name: '01-extrato.csv', content: 'Descrição;Valor\r\nAçaí;10,00' },
      { name: '02-contas.csv', content: 'Nome\r\n"Conta; com ponto e vírgula"' },
    ])

    const out = unzipSync(new Uint8Array(buffer))

    expect(Object.keys(out).sort()).toEqual(['01-extrato.csv', '02-contas.csv'])
    expect(strFromU8(out['01-extrato.csv'])).toBe('Descrição;Valor\r\nAçaí;10,00')
    expect(strFromU8(out['02-contas.csv'])).toBe('Nome\r\n"Conta; com ponto e vírgula"')
  })

  it('preserva o BOM UTF-8 que o Excel pt-BR exige', () => {
    const buffer = createZip([{ name: 'a.csv', content: '﻿Nome;Valor' }])
    const bytes = unzipSync(new Uint8Array(buffer))['a.csv']

    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })

  it('aceita lista vazia sem estourar', () => {
    const buffer = createZip([])
    expect(Object.keys(unzipSync(new Uint8Array(buffer)))).toEqual([])
  })
})
```

O teste do BOM não é decorativo: `sheetToCsv` prefixa `﻿` justamente porque sem ele o Excel abre em latin-1 e corrompe acentos. Qualquer troca de encoder que perca o BOM quebra o CSV inteiro sem quebrar nenhum outro teste.

- [ ] **Step 3: Rodar os testes e ver falhar**

```bash
npm test -- export-zip
```

Esperado: FAIL — `Failed to resolve import "@/lib/export/zip"`.

- [ ] **Step 4: Implementar**

Criar `lib/export/zip.ts`:

```ts
// lib/export/zip.ts
import { zipSync } from 'fflate'

export interface ZipEntry {
  name: string
  content: string
}

/**
 * Monta um ZIP em memória a partir de arquivos de texto.
 *
 * O `fflate` já está na árvore por baixo do write-excel-file (um .xlsx É um zip);
 * declará-lo como dependência direta evita reimplementar container binário à mão
 * e dá o unzipSync usado no teste de round-trip.
 */
export function createZip(entries: ZipEntry[]): Buffer {
  const encoder = new TextEncoder()
  const files: Record<string, Uint8Array> = {}

  for (const entry of entries) {
    files[entry.name] = encoder.encode(entry.content)
  }

  return Buffer.from(zipSync(files, { level: 6 }))
}

export function toZipResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 5: Rodar os testes e ver passar**

```bash
npm test -- export-zip
```

Esperado: PASS, 3 testes.

- [ ] **Step 6: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add package.json package-lock.json lib/export/zip.ts __tests__/unit/export-zip.test.ts
git commit -m "feat(export): container zip sobre fflate"
```

---

### Task 2: Query — todos os grupos de parcela

**Files:**
- Modify: `lib/queries/parcelas.ts:11-88`
- Test: `__tests__/integration/export-queries.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `getAllInstallmentGroups(userId: string)` e o tipo `InstallmentGroupRow`. Devolve o mesmo shape de `getActiveInstallmentGroups` — `{ id, name, categoryId, accountId, accountName, categoryName, categoryColor, startDate, nextChargeMonth, nextChargeDate, totalAmount, totalInstallments, paidInstallments, remainingInstallments, installmentAmount, remainingAmount }` — sem o filtro final.

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/integration/export-queries.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createAccount,
  createCategory,
  createCategoryGroup,
  createInstallmentGroup,
  createTransaction,
  createUser,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let accountId: string
let categoryId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `export-queries-${Date.now()}`))
  ;({ id: accountId } = await createAccount(db, userId))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
})

describe('getAllInstallmentGroups', () => {
  it('inclui grupo já quitado, que getActiveInstallmentGroups esconde', async () => {
    const { id: groupId } = await createInstallmentGroup(db, userId, accountId, categoryId, {
      name: 'Quitado',
      totalAmount: '300.00',
      totalInstallments: 3,
      startDate: '2020-01-01',
    })

    // Três parcelas, todas em meses passados => paidInstallments === 3, remaining === 0
    for (const month of ['2020-01-01', '2020-02-01', '2020-03-01']) {
      await createTransaction(db, userId, accountId, {
        categoryId,
        installmentGroupId: groupId,
        referenceMonth: month,
        date: month,
        amount: '100.00',
      })
    }

    const { getAllInstallmentGroups, getActiveInstallmentGroups } = await import(
      '@/lib/queries/parcelas'
    )

    const all = await getAllInstallmentGroups(userId)
    const active = await getActiveInstallmentGroups(userId)

    expect(all.map((g) => g.id)).toContain(groupId)
    expect(active.map((g) => g.id)).not.toContain(groupId)

    const quitado = all.find((g) => g.id === groupId)
    expect(quitado?.paidInstallments).toBe(3)
    expect(quitado?.remainingInstallments).toBe(0)
  })
})
```

Esse é o caso que só a implementação certa passa. Um teste com grupos ativos passaria igual se alguém reusasse `getActiveInstallmentGroups` — que é o caminho natural — e o bug ficaria invisível.

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npm run test:integration -- export-queries
```

Esperado: FAIL — `getAllInstallmentGroups is not a function`.

- [ ] **Step 3: Extrair o corpo compartilhado**

Em `lib/queries/parcelas.ts`, renomear a função atual para uma privada sem o `.filter` final e criar as duas públicas. Substituir as linhas 11-88 por:

```ts
async function collectInstallmentGroups(userId: string) {
  const currentMonthStr = currentReferenceMonth()

  const [groups, txRows, dek] = await Promise.all([
    db
      .select({
        id: installmentGroups.id,
        name: installmentGroups.name,
        totalAmount: installmentGroups.totalAmount,
        totalInstallments: installmentGroups.totalInstallments,
        startDate: installmentGroups.startDate,
        categoryId: installmentGroups.categoryId,
        accountId: installmentGroups.accountId,
        accountName: paymentAccounts.name,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(installmentGroups)
      .innerJoin(paymentAccounts, eq(installmentGroups.accountId, paymentAccounts.id))
      .innerJoin(categories, eq(installmentGroups.categoryId, categories.id))
      .where(eq(installmentGroups.userId, userId)),
    db
      .select({
        installmentGroupId: transactions.installmentGroupId,
        referenceMonth: transactions.referenceMonth,
        date: transactions.date,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNotNull(transactions.installmentGroupId))),
    getDekForUser(userId),
  ])

  const txByGroup = new Map<string, typeof txRows>()
  for (const tx of txRows) {
    const gid = tx.installmentGroupId!
    const list = txByGroup.get(gid) ?? []
    list.push(tx)
    txByGroup.set(gid, list)
  }

  return groups.map((group) => {
    const totalAmount = toAmount(decryptField(group.totalAmount, dek))
    const totalInstallments = group.totalInstallments
    const installmentAmount = parseFloat((totalAmount / totalInstallments).toFixed(2))
    const groupTxs = txByGroup.get(group.id) ?? []

    const paidInstallments = groupTxs.filter((t) => t.referenceMonth < currentMonthStr).length

    const remainingInstallments = totalInstallments - paidInstallments
    const remainingAmount = remainingInstallments * installmentAmount

    const nextTx = groupTxs
      .filter((t) => t.referenceMonth >= currentMonthStr)
      .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))[0]

    return {
      id: group.id,
      name: decryptField(group.name, dek),
      categoryId: group.categoryId,
      accountId: group.accountId,
      accountName: decryptField(group.accountName, dek),
      categoryName: decryptField(group.categoryName, dek),
      categoryColor: group.categoryColor ?? undefined,
      startDate: group.startDate,
      nextChargeMonth: nextTx ? nextTx.referenceMonth.slice(0, 7) : null,
      nextChargeDate: nextTx?.date ?? null,
      totalAmount,
      totalInstallments,
      paidInstallments,
      remainingInstallments,
      installmentAmount,
      remainingAmount,
    }
  })
}

/** Parcelas com saldo futuro — o que a tela /parcelas mostra. */
export async function getActiveInstallmentGroups(userId: string) {
  const groups = await collectInstallmentGroups(userId)
  return groups.filter((g) => g.remainingInstallments > 0)
}

/**
 * Todos os grupos, inclusive os já quitados. Exclusivo da exportação completa:
 * o histórico quitado é justamente o que o usuário quer levar embora.
 */
export async function getAllInstallmentGroups(userId: string) {
  return collectInstallmentGroups(userId)
}

export type InstallmentGroupRow = Awaited<ReturnType<typeof getAllInstallmentGroups>>[number]
```

A regra de `paidInstallments` (`referenceMonth < currentMonthStr`, mês corrente conta como pendente) fica num lugar só. Duplicá-la é como as duas divergem.

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npm run test:integration -- export-queries
```

Esperado: PASS.

- [ ] **Step 5: Confirmar que a tela /parcelas não regrediu**

```bash
npm test && npm run test:integration -- installments
```

Esperado: PASS. `getActiveInstallmentGroups` mudou de forma mas não de comportamento.

- [ ] **Step 6: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/queries/parcelas.ts __tests__/integration/export-queries.test.ts
git commit -m "feat(export): getAllInstallmentGroups incluindo grupos quitados"
```

---

### Task 3: Queries — aportes e resgates completos

**Files:**
- Modify: `lib/queries/investments.ts:143-165`
- Test: `__tests__/integration/export-queries.test.ts` (append)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `getAllInvestmentEntries(userId: string)` → `{ id, referenceMonth, typeName, amount, yieldAmount, excludeFromCashFlow, notes }[]`, tipo `InvestmentEntryRow`.
  - `getAllInvestmentWithdrawals(userId: string)` → mesmo shape de `getInvestmentWithdrawals`: `{ id, investmentTypeId, typeName, amount, taxAmount, date, destination, notes }[]`, tipo `WithdrawalRow`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `__tests__/integration/export-queries.test.ts`:

```ts
describe('getAllInvestmentWithdrawals', () => {
  it('inclui resgate anterior à janela de 6 meses de getInvestmentWithdrawals', async () => {
    const { createInvestmentType } = await import('./helpers/factories')
    const { id: typeId } = await createInvestmentType(db, userId, { name: 'CDB Antigo' })

    await db.insert((await import('@/lib/db/schema')).investmentWithdrawals).values({
      userId,
      investmentTypeId: typeId,
      amount: '900.00',
      taxAmount: '100.00',
      date: '2020-05-10',
      destination: 'income',
    })

    const { getAllInvestmentWithdrawals, getInvestmentWithdrawals } = await import(
      '@/lib/queries/investments'
    )

    const all = await getAllInvestmentWithdrawals(userId)
    const recent = await getInvestmentWithdrawals(userId)

    const antigo = all.find((w) => w.date === '2020-05-10')
    expect(antigo).toBeDefined()
    expect(antigo?.amount).toBe(900)
    expect(antigo?.taxAmount).toBe(100)
    expect(recent.some((w) => w.date === '2020-05-10')).toBe(false)
  })
})

describe('getAllInvestmentEntries', () => {
  it('traz aportes de todos os tipos, com rendimento e flag de fluxo de caixa', async () => {
    const { createInvestmentType } = await import('./helpers/factories')
    const { id: typeId } = await createInvestmentType(db, userId, { name: 'Tesouro' })

    await db.insert((await import('@/lib/db/schema')).investments).values({
      userId,
      investmentTypeId: typeId,
      amount: '500.00',
      yieldAmount: '25.50',
      referenceMonth: '2021-03-01',
      excludeFromCashFlow: true,
      notes: 'rolagem',
    })

    const { getAllInvestmentEntries } = await import('@/lib/queries/investments')
    const rows = await getAllInvestmentEntries(userId)

    const entry = rows.find((r) => r.referenceMonth === '2021-03-01')
    expect(entry?.typeName).toBe('Tesouro')
    expect(entry?.amount).toBe(500)
    expect(entry?.yieldAmount).toBe(25.5)
    expect(entry?.excludeFromCashFlow).toBe(true)
  })
})
```

A data de 2020 no primeiro teste é o ponto: com `getInvestmentWithdrawals` reusada, a linha simplesmente não aparece, e nenhuma outra asserção acusaria.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm run test:integration -- export-queries
```

Esperado: FAIL — `getAllInvestmentWithdrawals is not a function`.

- [ ] **Step 3: Implementar, compartilhando o mapeador**

Em `lib/queries/investments.ts`, substituir `getInvestmentWithdrawals` (linhas 143-165) por:

```ts
type WithdrawalDbRow = {
  id: string
  investmentTypeId: string
  amount: string
  taxAmount: string | null
  date: string
  destination: string
  notes: string | null
  investmentType: { name: string }
}

function mapWithdrawal(r: WithdrawalDbRow, dek: Buffer) {
  return {
    id: r.id,
    investmentTypeId: r.investmentTypeId,
    typeName: decryptField(r.investmentType.name, dek),
    amount: toAmount(decryptField(r.amount, dek)),
    taxAmount: r.taxAmount !== null ? toAmount(decryptOptional(r.taxAmount, dek)) : null,
    date: r.date,
    destination: r.destination,
    notes: r.notes !== null ? decryptOptional(r.notes, dek) : null,
  }
}

/** Últimos 6 meses — o que a tela /investimentos mostra. */
export async function getInvestmentWithdrawals(userId: string) {
  const firstVisibleMonth = pastNMonths(6)[0]
  const dek = await getDekForUser(userId)
  const rows = await db.query.investmentWithdrawals.findMany({
    where: and(
      eq(investmentWithdrawals.userId, userId),
      gte(investmentWithdrawals.date, firstVisibleMonth)
    ),
    with: { investmentType: true },
    orderBy: (iw, { desc }) => [desc(iw.date)],
  })

  return rows.map((r) => mapWithdrawal(r, dek))
}

/** Histórico completo de resgates. Exclusivo da exportação completa. */
export async function getAllInvestmentWithdrawals(userId: string) {
  const dek = await getDekForUser(userId)
  const rows = await db.query.investmentWithdrawals.findMany({
    where: eq(investmentWithdrawals.userId, userId),
    with: { investmentType: true },
    orderBy: (iw, { desc }) => [desc(iw.date)],
  })

  return rows.map((r) => mapWithdrawal(r, dek))
}

export type WithdrawalRow = Awaited<ReturnType<typeof getAllInvestmentWithdrawals>>[number]

/** Todos os aportes, de todos os tipos. getInvestmentHistory é por tipo. */
export async function getAllInvestmentEntries(userId: string) {
  const dek = await getDekForUser(userId)
  const rows = await db.query.investments.findMany({
    where: eq(investments.userId, userId),
    with: { investmentType: true },
    orderBy: (i, { desc }) => [desc(i.referenceMonth)],
  })

  return rows.map((r) => ({
    id: r.id,
    referenceMonth: r.referenceMonth,
    typeName: decryptField(r.investmentType.name, dek),
    amount: toAmount(decryptOptional(r.amount, dek)),
    yieldAmount: toAmount(decryptOptional(r.yieldAmount, dek)),
    excludeFromCashFlow: r.excludeFromCashFlow,
    notes: r.notes !== null ? decryptOptional(r.notes, dek) : null,
  }))
}

export type InvestmentEntryRow = Awaited<ReturnType<typeof getAllInvestmentEntries>>[number]
```

`amount` e `yieldAmount` de `investments` são nullable no schema — por isso `decryptOptional`, nunca `decryptField` (que lança em null).

- [ ] **Step 4: Rodar e ver passar**

```bash
npm run test:integration -- export-queries
```

Esperado: PASS.

- [ ] **Step 5: Confirmar que /investimentos não regrediu**

```bash
npm run test:integration -- investments
```

Esperado: PASS.

- [ ] **Step 6: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/queries/investments.ts __tests__/integration/export-queries.test.ts
git commit -m "feat(export): queries completas de aportes e resgates"
```

---

### Task 4: Queries — overrides de orçamento e data mais antiga

**Files:**
- Modify: `lib/queries/categories.ts`
- Modify: `lib/queries/historico.ts`
- Test: `__tests__/integration/export-queries.test.ts` (append)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `getAllBudgetOverrides(userId: string)` → `{ referenceMonth, groupName, categoryName, amount }[]`, tipo `BudgetOverrideRow`.
  - `getEarliestActivityDate(userId: string): Promise<string | null>` — `YYYY-MM-DD` ou `null` em conta vazia.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `__tests__/integration/export-queries.test.ts`:

```ts
describe('getAllBudgetOverrides', () => {
  it('devolve uma linha por mês, não só o mês corrente', async () => {
    const schema = await import('@/lib/db/schema')
    await db.insert(schema.monthlyBudgetOverrides).values([
      { userId, categoryId, referenceMonth: '2024-01-01', amount: '300.00' },
      { userId, categoryId, referenceMonth: '2024-02-01', amount: '450.00' },
    ])

    const { getAllBudgetOverrides } = await import('@/lib/queries/categories')
    const rows = await getAllBudgetOverrides(userId)

    const meses = rows.filter((r) => r.referenceMonth.startsWith('2024-')).map((r) => r.referenceMonth)
    expect(meses.sort()).toEqual(['2024-01-01', '2024-02-01'])
    expect(rows.find((r) => r.referenceMonth === '2024-02-01')?.amount).toBe(450)
  })
})

describe('getEarliestActivityDate', () => {
  it('devolve a data mais antiga entre as tabelas de movimento', async () => {
    await createTransaction(db, userId, accountId, {
      categoryId,
      date: '2019-07-04',
      referenceMonth: '2019-07-01',
      amount: '10.00',
    })

    const { getEarliestActivityDate } = await import('@/lib/queries/historico')
    expect(await getEarliestActivityDate(userId)).toBe('2019-07-04')
  })

  it('devolve null para usuário sem movimento nenhum', async () => {
    const { id: vazio } = await createUser(db, `vazio-${Date.now()}`)
    const { getEarliestActivityDate } = await import('@/lib/queries/historico')
    expect(await getEarliestActivityDate(vazio)).toBeNull()
  })
})
```

Dois meses distintos no primeiro teste é o que separa a implementação certa da que reusa `getCategoriesWithBudgets(userId, mes)`.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm run test:integration -- export-queries
```

Esperado: FAIL — `getAllBudgetOverrides is not a function`.

- [ ] **Step 3: Implementar `getAllBudgetOverrides`**

Adicionar ao fim de `lib/queries/categories.ts`:

```ts
/**
 * Todos os overrides de orçamento, de todos os meses. getCategoriesWithBudgets
 * é por mês; a exportação completa precisa da série inteira para permitir
 * reconstruir o orçamento fora do app.
 */
export async function getAllBudgetOverrides(userId: string) {
  const [rows, dek] = await Promise.all([
    db
      .select({
        referenceMonth: monthlyBudgetOverrides.referenceMonth,
        amount: monthlyBudgetOverrides.amount,
        categoryName: categories.name,
        groupName: categoryGroups.name,
      })
      .from(monthlyBudgetOverrides)
      .innerJoin(categories, eq(monthlyBudgetOverrides.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(eq(monthlyBudgetOverrides.userId, userId)),
    getDekForUser(userId),
  ])

  return rows
    .map((r) => ({
      referenceMonth: r.referenceMonth,
      groupName: decryptField(r.groupName, dek),
      categoryName: decryptField(r.categoryName, dek),
      amount: toAmount(decryptField(r.amount, dek)),
    }))
    .sort(
      (a, b) =>
        a.referenceMonth.localeCompare(b.referenceMonth) ||
        a.categoryName.localeCompare(b.categoryName, 'pt-BR')
    )
}

export type BudgetOverrideRow = Awaited<ReturnType<typeof getAllBudgetOverrides>>[number]
```

Ajustar os imports do topo do arquivo: `categories` (a tabela) e `toAmount` ainda não estão importados ali.

```ts
import { categories, categoryGroups, monthlyBudgetOverrides, paymentAccounts } from '@/lib/db/schema'
import { toAmount } from '@/lib/utils/currency'
```

- [ ] **Step 4: Implementar `getEarliestActivityDate`**

Adicionar ao fim de `lib/queries/historico.ts`:

```ts
/**
 * Piso do recorte da exportação completa.
 *
 * collectHistoricoItems exige de/ate, e referenceMonthsInRange materializa um mês
 * por elemento num inArray — chutar '1970-01-01' geraria ~670 elementos no IN.
 *
 * Colunas de data não são cifradas (só nome, descrição e valor são), então MIN em
 * SQL é legítimo aqui.
 */
export async function getEarliestActivityDate(userId: string): Promise<string | null> {
  const [tx, inc, fx, inv, wd] = await Promise.all([
    db
      .select({ min: sql<string | null>`min(${transactions.date})` })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    db
      .select({ min: sql<string | null>`min(${incomes.referenceMonth})` })
      .from(incomes)
      .where(eq(incomes.userId, userId)),
    db
      .select({ min: sql<string | null>`min(${fixedExpenses.referenceMonth})` })
      .from(fixedExpenses)
      .where(eq(fixedExpenses.userId, userId)),
    db
      .select({ min: sql<string | null>`min(${investments.referenceMonth})` })
      .from(investments)
      .where(eq(investments.userId, userId)),
    db
      .select({ min: sql<string | null>`min(${investmentWithdrawals.date})` })
      .from(investmentWithdrawals)
      .where(eq(investmentWithdrawals.userId, userId)),
  ])

  const candidates = [tx[0]?.min, inc[0]?.min, fx[0]?.min, inv[0]?.min, wd[0]?.min].filter(
    (d): d is string => d != null
  )

  if (candidates.length === 0) return null
  return candidates.sort()[0]
}
```

Conferir que `sql`, `investments` e `investmentWithdrawals` estão nos imports do arquivo; adicionar o que faltar.

- [ ] **Step 5: Rodar e ver passar**

```bash
npm run test:integration -- export-queries
```

Esperado: PASS, os 4 testes desta task.

- [ ] **Step 6: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/queries/categories.ts lib/queries/historico.ts __tests__/integration/export-queries.test.ts
git commit -m "feat(export): queries de overrides de orçamento e data mais antiga"
```

---

### Task 5: Builders — contas, categorias e orçamentos

**Files:**
- Create: `lib/export/full/contas.ts`
- Create: `lib/export/full/categorias.ts`
- Test: `__tests__/unit/export-full-cadastros.test.ts`

**Interfaces:**
- Consumes: `getPaymentAccounts` e `getCategoriesWithGroups` (existentes, `lib/queries/categories.ts`); `BudgetOverrideRow` (Task 4).
- Produces:
  - `CONTAS_HEADERS`, `CONTAS_WIDTHS`, `buildContasRows(accounts): SheetData`
  - `CATEGORIAS_HEADERS`, `CATEGORIAS_WIDTHS`, `buildCategoriasRows(groups): SheetData`
  - `ORCAMENTOS_HEADERS`, `ORCAMENTOS_WIDTHS`, `buildOrcamentosRows(overrides: BudgetOverrideRow[]): SheetData`

- [ ] **Step 1: Escrever os testes que falham**

Criar `__tests__/unit/export-full-cadastros.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildContasRows, CONTAS_HEADERS } from '@/lib/export/full/contas'
import {
  buildCategoriasRows,
  buildOrcamentosRows,
  CATEGORIAS_HEADERS,
  ORCAMENTOS_HEADERS,
} from '@/lib/export/full/categorias'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

describe('buildContasRows', () => {
  it('traduz o tipo e mantém o dia de fechamento', () => {
    const rows = buildContasRows([
      { id: 'a', userId: 'u', name: 'Nubank', type: 'credit', closingDay: 8 },
      { id: 'b', userId: 'u', name: 'Carteira', type: 'pix', closingDay: null },
    ])

    expect(values(rows[0])).toEqual(CONTAS_HEADERS)
    expect(values(rows[1])).toEqual(['Nubank', 'Crédito', 8])
    expect(values(rows[2])).toEqual(['Carteira', 'Pix', ''])
  })

  it('lista vazia produz só o cabeçalho', () => {
    expect(buildContasRows([])).toHaveLength(1)
  })
})

describe('buildCategoriasRows', () => {
  it('achata grupo × categoria, uma linha por categoria', () => {
    const rows = buildCategoriasRows([
      {
        id: 'g1',
        userId: 'u',
        name: 'Essenciais',
        sortOrder: 0,
        categories: [
          {
            id: 'c1',
            userId: 'u',
            groupId: 'g1',
            name: 'Mercado',
            defaultBudget: '800.00',
            color: '#111111',
            bgColor: '#eeeeee',
          },
          {
            id: 'c2',
            userId: 'u',
            groupId: 'g1',
            name: 'Transporte',
            defaultBudget: null,
            color: null,
            bgColor: null,
          },
        ],
      },
    ])

    expect(values(rows[0])).toEqual(CATEGORIAS_HEADERS)
    expect(values(rows[1])).toEqual(['Essenciais', 'Mercado', 800, '#111111'])
    expect(values(rows[2])).toEqual(['Essenciais', 'Transporte', '', ''])
  })
})

describe('buildOrcamentosRows', () => {
  it('emite uma linha por mês da mesma categoria', () => {
    const rows = buildOrcamentosRows([
      { referenceMonth: '2024-01-01', groupName: 'Essenciais', categoryName: 'Mercado', amount: 300 },
      { referenceMonth: '2024-02-01', groupName: 'Essenciais', categoryName: 'Mercado', amount: 450 },
    ])

    expect(values(rows[0])).toEqual(ORCAMENTOS_HEADERS)
    expect(rows).toHaveLength(3)
    expect(values(rows[1])).toEqual(['2024-01-01', 'Essenciais', 'Mercado', 300])
    expect(values(rows[2])).toEqual(['2024-02-01', 'Essenciais', 'Mercado', 450])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- export-full-cadastros
```

Esperado: FAIL — `Failed to resolve import "@/lib/export/full/contas"`.

- [ ] **Step 3: Implementar `contas.ts`**

```ts
// lib/export/full/contas.ts
import type { Row, SheetData } from 'write-excel-file/node'
import { headerRow, textCell } from '../xlsx'

type AccountRow = {
  name: string
  type: string
  closingDay: number | null
}

const TIPO_LABELS: Record<string, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
}

export const CONTAS_HEADERS = ['Nome', 'Tipo', 'Dia de fechamento']

export const CONTAS_WIDTHS = [24, 14, 18]

function contaRow(account: AccountRow): Row {
  return [
    textCell(account.name),
    textCell(TIPO_LABELS[account.type] ?? account.type),
    account.closingDay != null
      ? { value: account.closingDay, type: Number }
      : textCell(null),
  ]
}

export function buildContasRows(accounts: AccountRow[]): SheetData {
  return [headerRow(CONTAS_HEADERS), ...accounts.map(contaRow)]
}
```

- [ ] **Step 4: Implementar `categorias.ts`**

```ts
// lib/export/full/categorias.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { BudgetOverrideRow } from '@/lib/queries/categories'
import { toAmount } from '@/lib/utils/currency'
import { headerRow, moneyCell, textCell } from '../xlsx'

type CategoryRow = {
  name: string
  defaultBudget: string | null
  color: string | null
}

type GroupRow = {
  name: string
  categories: CategoryRow[]
}

export const CATEGORIAS_HEADERS = ['Grupo', 'Categoria', 'Orçamento padrão', 'Cor']

export const CATEGORIAS_WIDTHS = [22, 24, 18, 12]

export const ORCAMENTOS_HEADERS = ['Mês de referência', 'Grupo', 'Categoria', 'Valor']

export const ORCAMENTOS_WIDTHS = [18, 22, 24, 14]

function categoriaRow(groupName: string, category: CategoryRow): Row {
  return [
    textCell(groupName),
    textCell(category.name),
    category.defaultBudget != null ? moneyCell(toAmount(category.defaultBudget)) : textCell(null),
    textCell(category.color),
  ]
}

export function buildCategoriasRows(groups: GroupRow[]): SheetData {
  const rows: Row[] = []
  for (const group of groups) {
    for (const category of group.categories) {
      rows.push(categoriaRow(group.name, category))
    }
  }
  return [headerRow(CATEGORIAS_HEADERS), ...rows]
}

function orcamentoRow(override: BudgetOverrideRow): Row {
  return [
    textCell(override.referenceMonth),
    textCell(override.groupName),
    textCell(override.categoryName),
    moneyCell(override.amount),
  ]
}

export function buildOrcamentosRows(overrides: BudgetOverrideRow[]): SheetData {
  return [headerRow(ORCAMENTOS_HEADERS), ...overrides.map(orcamentoRow)]
}
```

O laço aninhado usa `for` e `rows.push`, não `reduce` com spread nem `let` reatribuído em callback — a regra `react-hooks/immutability` do ESLint do projeto reprova a segunda forma.

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test -- export-full-cadastros
```

Esperado: PASS, 4 testes.

- [ ] **Step 6: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/export/full/ __tests__/unit/export-full-cadastros.test.ts
git commit -m "feat(export): builders de contas, categorias e orçamentos"
```

---

### Task 6: Builder — parcelas

**Files:**
- Create: `lib/export/full/parcelas.ts`
- Test: `__tests__/unit/export-full-parcelas.test.ts`

**Interfaces:**
- Consumes: `InstallmentGroupRow` (Task 2).
- Produces: `PARCELAS_HEADERS`, `PARCELAS_WIDTHS`, `buildParcelasRows(groups: InstallmentGroupRow[]): SheetData`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/unit/export-full-parcelas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildParcelasRows, PARCELAS_HEADERS } from '@/lib/export/full/parcelas'
import type { InstallmentGroupRow } from '@/lib/queries/parcelas'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

function grupo(overrides: Partial<InstallmentGroupRow> = {}): InstallmentGroupRow {
  return {
    id: 'g1',
    name: 'Notebook',
    categoryId: 'c1',
    accountId: 'a1',
    accountName: 'Nubank',
    categoryName: 'Eletrônicos',
    categoryColor: undefined,
    startDate: '2025-01-05',
    nextChargeMonth: '2025-03',
    nextChargeDate: '2025-03-05',
    totalAmount: 1200,
    totalInstallments: 12,
    paidInstallments: 2,
    remainingInstallments: 10,
    installmentAmount: 100,
    remainingAmount: 1000,
    ...overrides,
  }
}

describe('buildParcelasRows', () => {
  it('emite grupo quitado, não só os ativos', () => {
    const rows = buildParcelasRows([
      grupo({ id: 'ativo', name: 'Ativo' }),
      grupo({
        id: 'quitado',
        name: 'Quitado',
        paidInstallments: 12,
        remainingInstallments: 0,
        remainingAmount: 0,
      }),
    ])

    expect(values(rows[0])).toEqual(PARCELAS_HEADERS)
    expect(rows).toHaveLength(3)
    expect(values(rows[2])[0]).toBe('Quitado')
    expect(values(rows[2])[7]).toBe(12)
    expect(values(rows[2])[8]).toBe(0)
  })

  it('emite a data de início como Date, não texto', () => {
    const rows = buildParcelasRows([grupo()])
    expect((rows[1][4] as { value: unknown }).value).toBeInstanceOf(Date)
  })

  it('lista vazia produz só o cabeçalho', () => {
    expect(buildParcelasRows([])).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- export-full-parcelas
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/export/full/parcelas.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { InstallmentGroupRow } from '@/lib/queries/parcelas'
import { dateCell, headerRow, moneyCell, textCell } from '../xlsx'

export const PARCELAS_HEADERS = [
  'Descrição',
  'Valor total',
  'Nº de parcelas',
  'Valor da parcela',
  'Data de início',
  'Categoria',
  'Conta',
  'Parcelas pagas',
  'Restantes',
]

export const PARCELAS_WIDTHS = [36, 14, 14, 16, 14, 22, 20, 16, 12]

function parcelaRow(group: InstallmentGroupRow): Row {
  return [
    textCell(group.name),
    moneyCell(group.totalAmount),
    { value: group.totalInstallments, type: Number },
    moneyCell(group.installmentAmount),
    dateCell(group.startDate),
    textCell(group.categoryName),
    textCell(group.accountName),
    { value: group.paidInstallments, type: Number },
    { value: group.remainingInstallments, type: Number },
  ]
}

export function buildParcelasRows(groups: InstallmentGroupRow[]): SheetData {
  return [headerRow(PARCELAS_HEADERS), ...groups.map(parcelaRow)]
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- export-full-parcelas
```

Esperado: PASS, 3 testes.

- [ ] **Step 5: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/export/full/parcelas.ts __tests__/unit/export-full-parcelas.test.ts
git commit -m "feat(export): builder de parcelas"
```

---

### Task 7: Builders — investimentos

**Files:**
- Create: `lib/export/full/investimentos.ts`
- Test: `__tests__/unit/export-full-investimentos.test.ts`

**Interfaces:**
- Consumes: `InvestmentEntryRow` e `WithdrawalRow` (Task 3); `getInvestmentTypes` (existente).
- Produces: `TIPOS_HEADERS`/`TIPOS_WIDTHS`/`buildTiposRows`, `APORTES_HEADERS`/`APORTES_WIDTHS`/`buildAportesRows`, `RESGATES_HEADERS`/`RESGATES_WIDTHS`/`buildResgatesRows`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `__tests__/unit/export-full-investimentos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  APORTES_HEADERS,
  buildAportesRows,
  buildResgatesRows,
  buildTiposRows,
  RESGATES_HEADERS,
  TIPOS_HEADERS,
} from '@/lib/export/full/investimentos'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

describe('buildResgatesRows', () => {
  it('calcula o valor bruto como líquido + imposto', () => {
    const rows = buildResgatesRows([
      {
        id: 'w1',
        investmentTypeId: 't1',
        typeName: 'CDB',
        amount: 900,
        taxAmount: 100,
        date: '2025-04-10',
        destination: 'income',
        notes: null,
      },
    ])

    expect(values(rows[0])).toEqual(RESGATES_HEADERS)
    // Data, Tipo, Líquido, Imposto, Bruto, Destino, Observações
    expect(values(rows[1]).slice(2, 6)).toEqual([900, 100, 1000, 'Caixa'])
  })

  it('trata imposto nulo como zero no bruto', () => {
    const rows = buildResgatesRows([
      {
        id: 'w2',
        investmentTypeId: 't1',
        typeName: 'CDB',
        amount: 500,
        taxAmount: null,
        date: '2025-05-10',
        destination: 'reinvest',
        notes: null,
      },
    ])

    expect(values(rows[1]).slice(2, 6)).toEqual([500, '', 500, 'Reinvestimento'])
  })
})

describe('buildAportesRows', () => {
  it('emite a flag de fluxo de caixa como Sim/Não', () => {
    const rows = buildAportesRows([
      {
        id: 'i1',
        referenceMonth: '2025-03-01',
        typeName: 'Tesouro',
        amount: 500,
        yieldAmount: 25.5,
        excludeFromCashFlow: true,
        notes: 'rolagem',
      },
    ])

    expect(values(rows[0])).toEqual(APORTES_HEADERS)
    expect(values(rows[1])).toEqual(['2025-03-01', 'Tesouro', 500, 25.5, 'Sim', 'rolagem'])
  })
})

describe('buildTiposRows', () => {
  it('marca arquivado e vencimento vazio', () => {
    const rows = buildTiposRows([
      {
        id: 't1',
        userId: 'u',
        name: 'CDB',
        color: null,
        bgColor: null,
        goalId: null,
        maturityDate: null,
        archived: true,
      },
    ])

    expect(values(rows[0])).toEqual(TIPOS_HEADERS)
    expect(values(rows[1])).toEqual(['CDB', '', 'Arquivado'])
  })
})
```

O caso de `taxAmount: null` é o par obrigatório do caso com imposto: uma implementação que devolvesse `amount` cru como bruto passaria no segundo teste e falharia só no primeiro.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- export-full-investimentos
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/export/full/investimentos.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { InvestmentEntryRow, WithdrawalRow } from '@/lib/queries/investments'
import { dateCell, headerRow, moneyCell, textCell } from '../xlsx'

const DESTINO_LABELS: Record<string, string> = {
  income: 'Caixa',
  reinvest: 'Reinvestimento',
  transfer: 'Transferência',
}

type TypeRow = {
  name: string
  maturityDate: string | null
  archived: boolean
}

export const TIPOS_HEADERS = ['Nome', 'Vencimento', 'Situação']
export const TIPOS_WIDTHS = [24, 14, 14]

export const APORTES_HEADERS = [
  'Mês de referência',
  'Tipo',
  'Aporte',
  'Rendimento',
  'Fora do fluxo de caixa',
  'Observações',
]
export const APORTES_WIDTHS = [18, 24, 14, 14, 22, 30]

export const RESGATES_HEADERS = [
  'Data',
  'Tipo',
  'Valor líquido',
  'Imposto',
  'Valor bruto',
  'Destino',
  'Observações',
]
export const RESGATES_WIDTHS = [12, 24, 16, 14, 16, 18, 30]

function tipoRow(type: TypeRow): Row {
  return [
    textCell(type.name),
    type.maturityDate ? dateCell(type.maturityDate) : textCell(null),
    textCell(type.archived ? 'Arquivado' : 'Ativo'),
  ]
}

export function buildTiposRows(types: TypeRow[]): SheetData {
  return [headerRow(TIPOS_HEADERS), ...types.map(tipoRow)]
}

function aporteRow(entry: InvestmentEntryRow): Row {
  return [
    textCell(entry.referenceMonth),
    textCell(entry.typeName),
    moneyCell(entry.amount),
    moneyCell(entry.yieldAmount),
    textCell(entry.excludeFromCashFlow ? 'Sim' : 'Não'),
    textCell(entry.notes),
  ]
}

export function buildAportesRows(entries: InvestmentEntryRow[]): SheetData {
  return [headerRow(APORTES_HEADERS), ...entries.map(aporteRow)]
}

/**
 * investmentWithdrawals.amount é LÍQUIDO (bruto − imposto). O bruto vai em coluna
 * própria em vez de deixar o usuário somar: essa distinção já foi fonte de erro
 * dentro do próprio app (ver .claude/domain.md).
 */
function resgateRow(withdrawal: WithdrawalRow): Row {
  const tax = withdrawal.taxAmount ?? 0
  return [
    dateCell(withdrawal.date),
    textCell(withdrawal.typeName),
    moneyCell(withdrawal.amount),
    withdrawal.taxAmount != null ? moneyCell(withdrawal.taxAmount) : textCell(null),
    moneyCell(withdrawal.amount + tax),
    textCell(DESTINO_LABELS[withdrawal.destination] ?? withdrawal.destination),
    textCell(withdrawal.notes),
  ]
}

export function buildResgatesRows(withdrawals: WithdrawalRow[]): SheetData {
  return [headerRow(RESGATES_HEADERS), ...withdrawals.map(resgateRow)]
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- export-full-investimentos
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/export/full/investimentos.ts __tests__/unit/export-full-investimentos.test.ts
git commit -m "feat(export): builders de investimentos, aportes e resgates"
```

---

### Task 8: Builders — metas e contribuições

**Files:**
- Create: `lib/export/full/metas.ts`
- Test: `__tests__/unit/export-full-metas.test.ts`

**Interfaces:**
- Consumes: `GoalWithProgress` de `@/lib/queries/goals` (existente — já traz `contributions[]` decriptado).
- Produces: `METAS_HEADERS`/`METAS_WIDTHS`/`buildMetasRows(goals: GoalWithProgress[])`, `CONTRIBUICOES_HEADERS`/`CONTRIBUICOES_WIDTHS`/`buildContribuicoesRows(goals: GoalWithProgress[])`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `__tests__/unit/export-full-metas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildContribuicoesRows,
  buildMetasRows,
  CONTRIBUICOES_HEADERS,
  METAS_HEADERS,
} from '@/lib/export/full/metas'
import type { GoalWithProgress } from '@/lib/queries/goals'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

function meta(overrides: Partial<GoalWithProgress> = {}): GoalWithProgress {
  return {
    id: 'm1',
    name: 'Reserva',
    targetAmount: 10000,
    targetDate: '2026-12-31',
    investmentTypeId: null,
    investmentTypeName: null,
    currentBalance: 2500,
    progress: 25,
    projectedCompletionYearMonth: '2027-04',
    contributions: [],
    ...overrides,
  }
}

describe('buildMetasRows', () => {
  it('emite alvo, saldo e progresso arredondado', () => {
    const rows = buildMetasRows([meta()])

    expect(values(rows[0])).toEqual(METAS_HEADERS)
    expect(values(rows[1])).toEqual(['Reserva', 10000, expect.any(Date), '', 2500, 25])
  })

  it('meta sem data alvo emite célula vazia', () => {
    const rows = buildMetasRows([meta({ targetDate: null })])
    expect(values(rows[1])[2]).toBe('')
  })
})

describe('buildContribuicoesRows', () => {
  it('achata as contribuições de todas as metas, repetindo o nome da meta', () => {
    const rows = buildContribuicoesRows([
      meta({
        name: 'Reserva',
        contributions: [
          { id: 'c1', amount: 500, referenceMonth: '2025-01-01', source: 'manual' },
          { id: 'c2', amount: 700, referenceMonth: '2025-02-01', source: 'investment' },
        ],
      }),
      meta({ id: 'm2', name: 'Viagem', contributions: [] }),
    ])

    expect(values(rows[0])).toEqual(CONTRIBUICOES_HEADERS)
    expect(rows).toHaveLength(3)
    expect(values(rows[1])).toEqual(['Reserva', '2025-01-01', 500, 'Manual'])
    expect(values(rows[2])).toEqual(['Reserva', '2025-02-01', 700, 'Investimento'])
  })

  it('nenhuma meta com contribuição produz só o cabeçalho', () => {
    expect(buildContribuicoesRows([meta()])).toHaveLength(1)
  })
})
```

A meta sem contribuição no primeiro teste garante que o achatamento não emita linha órfã para ela.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- export-full-metas
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/export/full/metas.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { GoalWithProgress } from '@/lib/queries/goals'
import { dateCell, headerRow, moneyCell, textCell } from '../xlsx'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  investment: 'Investimento',
}

export const METAS_HEADERS = [
  'Nome',
  'Valor alvo',
  'Data alvo',
  'Tipo de investimento',
  'Saldo atual',
  'Progresso (%)',
]
export const METAS_WIDTHS = [28, 14, 14, 24, 14, 16]

export const CONTRIBUICOES_HEADERS = ['Meta', 'Mês de referência', 'Valor', 'Origem']
export const CONTRIBUICOES_WIDTHS = [28, 18, 14, 18]

function metaRow(goal: GoalWithProgress): Row {
  return [
    textCell(goal.name),
    moneyCell(goal.targetAmount),
    goal.targetDate ? dateCell(goal.targetDate) : textCell(null),
    textCell(goal.investmentTypeName),
    moneyCell(goal.currentBalance),
    { value: Math.round(goal.progress), type: Number },
  ]
}

export function buildMetasRows(goals: GoalWithProgress[]): SheetData {
  return [headerRow(METAS_HEADERS), ...goals.map(metaRow)]
}

/**
 * As contribuições já vêm aninhadas e decriptadas em GoalWithProgress.contributions
 * — não existe (nem precisa existir) query própria para elas.
 */
export function buildContribuicoesRows(goals: GoalWithProgress[]): SheetData {
  const rows: Row[] = []
  for (const goal of goals) {
    for (const contribution of goal.contributions) {
      rows.push([
        textCell(goal.name),
        textCell(contribution.referenceMonth),
        moneyCell(contribution.amount),
        textCell(SOURCE_LABELS[contribution.source] ?? contribution.source),
      ])
    }
  }
  return [headerRow(CONTRIBUICOES_HEADERS), ...rows]
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- export-full-metas
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/export/full/metas.ts __tests__/unit/export-full-metas.test.ts
git commit -m "feat(export): builders de metas e contribuições"
```

---

### Task 9: Coletor — `collectFullExport`

**Files:**
- Create: `lib/export/full/collect.ts`
- Test: `__tests__/integration/export-completo.test.ts`

**Interfaces:**
- Consumes: todos os builders das Tasks 5-8; `buildExtratoRows` + `EXTRATO_HEADERS` de `lib/export/extrato-xlsx.ts`; `buildSaldosRows` + `buildLancamentosRows` de `lib/export/devedores-xlsx.ts`; `collectHistoricoItems`, `getEarliestActivityDate`, `getPaymentAccounts`, `getCategoriesWithGroups`, `getAllBudgetOverrides`, `getAllInstallmentGroups`, `getInvestmentTypes`, `getAllInvestmentEntries`, `getAllInvestmentWithdrawals`, `getGoalsWithProgress`, `getPeopleWithBalances`, `getAllDebtorEntries`.
- Produces: `ExportSheet { name: string; filename: string; data: SheetData; widths: number[] }` e `collectFullExport(userId: string): Promise<ExportSheet[]>`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/integration/export-completo.test.ts`. Note o `encryptField` nos factories — sem ele o teste da Task 10 seria vazio.

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createAccount,
  createCategory,
  createCategoryGroup,
  createGoal,
  createGoalContribution,
  createInstallmentGroup,
  createInvestmentType,
  createPerson,
  createCharge,
  createTransaction,
  createUser,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string

/**
 * Popula um usuário com dado CIFRADO nos 12 domínios.
 *
 * Os factories inserem plaintext, e decryptField é backward-compat: repassa
 * plaintext adiante sem erro. Um dump montado sobre dado de factory nunca
 * conteria "enc:" nem com a query errada — o assert da Task 10 passaria
 * vazio. Cifrar aqui é o que dá sentido àquele teste.
 */
beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `export-completo-${Date.now()}`))

  const { getDekForUser } = await import('@/lib/crypto/keys')
  const { encryptField } = await import('@/lib/crypto/fields')
  const dek = await getDekForUser(userId)
  const enc = (v: string) => encryptField(v, dek)

  const { id: accountId } = await createAccount(db, userId, { name: enc('Nubank'), type: 'credit', closingDay: 8 })
  const { id: groupId } = await createCategoryGroup(db, userId, enc('Essenciais'))
  const { id: categoryId } = await createCategory(db, userId, groupId, {
    name: enc('Mercado'),
    defaultBudget: enc('800.00'),
  })

  await createTransaction(db, userId, accountId, {
    categoryId,
    name: enc('Supermercado'),
    amount: enc('150.00'),
    date: '2025-01-10',
    referenceMonth: '2025-01-01',
  })

  const schema = await import('@/lib/db/schema')
  await db.insert(schema.monthlyBudgetOverrides).values({
    userId,
    categoryId,
    referenceMonth: '2025-02-01',
    amount: enc('900.00'),
  })

  const { id: instGroupId } = await createInstallmentGroup(db, userId, accountId, categoryId, {
    name: enc('Notebook'),
    totalAmount: enc('1200.00'),
    totalInstallments: 12,
  })
  await createTransaction(db, userId, accountId, {
    categoryId,
    installmentGroupId: instGroupId,
    name: enc('Notebook (1/12)'),
    amount: enc('100.00'),
    date: '2025-01-05',
    referenceMonth: '2025-01-01',
  })

  const { id: typeId } = await createInvestmentType(db, userId, { name: enc('CDB') })
  await db.insert(schema.investments).values({
    userId,
    investmentTypeId: typeId,
    amount: enc('500.00'),
    yieldAmount: enc('25.00'),
    referenceMonth: '2025-01-01',
  })
  await db.insert(schema.investmentWithdrawals).values({
    userId,
    investmentTypeId: typeId,
    amount: enc('90.00'),
    taxAmount: enc('10.00'),
    date: '2025-02-10',
    destination: 'income',
  })

  const { id: goalId } = await createGoal(db, userId, {
    name: enc('Reserva'),
    targetAmount: enc('10000.00'),
  })
  await createGoalContribution(db, userId, goalId, { amount: enc('500.00') })

  const { id: personId } = await createPerson(db, userId, enc('João'))
  await createCharge(db, userId, personId, {
    amount: enc('100.00'),
    description: enc('Almoço'),
  })
})

describe('collectFullExport', () => {
  it('devolve as 12 planilhas na ordem declarada', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const sheets = await collectFullExport(userId)

    expect(sheets.map((s) => s.name)).toEqual([
      'Extrato',
      'Contas',
      'Categorias',
      'Orçamentos mensais',
      'Parcelas',
      'Investimentos — Tipos',
      'Investimentos — Aportes',
      'Investimentos — Resgates',
      'Metas',
      'Metas — Contribuições',
      'Devedores — Saldos',
      'Devedores — Lançamentos',
    ])
  })

  it('toda planilha tem cabeçalho e o filename é único', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const sheets = await collectFullExport(userId)

    for (const sheet of sheets) {
      expect(sheet.data.length).toBeGreaterThanOrEqual(1)
      expect(sheet.widths).toHaveLength(sheet.data[0].length)
    }

    const filenames = sheets.map((s) => s.filename)
    expect(new Set(filenames).size).toBe(filenames.length)
  })

  it('o extrato cobre desde a atividade mais antiga, sem janela de 90 dias', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const sheets = await collectFullExport(userId)
    const extrato = sheets.find((s) => s.name === 'Extrato')

    // 2 transações criadas em 2025-01, muito além dos 90 dias padrão
    expect(extrato!.data.length).toBeGreaterThanOrEqual(3)
  })
})
```

A terceira asserção é a que pega o erro mais provável: usar `parseHistoricoParams({})`, cujo default são os últimos 90 dias — o extrato sairia vazio e ninguém notaria.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm run test:integration -- export-completo
```

Esperado: FAIL — `Failed to resolve import "@/lib/export/full/collect"`.

- [ ] **Step 3: Implementar**

```ts
// lib/export/full/collect.ts
import type { SheetData } from 'write-excel-file/node'
import { getAllDebtorEntries, getPeopleWithBalances } from '@/lib/queries/debtors'
import { getAllBudgetOverrides, getCategoriesWithGroups, getPaymentAccounts } from '@/lib/queries/categories'
import { getGoalsWithProgress } from '@/lib/queries/goals'
import { collectHistoricoItems, getEarliestActivityDate } from '@/lib/queries/historico'
import {
  getAllInvestmentEntries,
  getAllInvestmentWithdrawals,
  getInvestmentTypes,
} from '@/lib/queries/investments'
import { getAllInstallmentGroups } from '@/lib/queries/parcelas'
import { todayISOString } from '@/lib/utils/date'
import { ALL_TIPOS } from '@/lib/utils/historico-params'
import { buildExtratoRows } from '../extrato-xlsx'
import { buildLancamentosRows, buildSaldosRows } from '../devedores-xlsx'
import { buildContasRows, CONTAS_WIDTHS } from './contas'
import {
  buildCategoriasRows,
  buildOrcamentosRows,
  CATEGORIAS_WIDTHS,
  ORCAMENTOS_WIDTHS,
} from './categorias'
import { buildParcelasRows, PARCELAS_WIDTHS } from './parcelas'
import {
  APORTES_WIDTHS,
  buildAportesRows,
  buildResgatesRows,
  buildTiposRows,
  RESGATES_WIDTHS,
  TIPOS_WIDTHS,
} from './investimentos'
import {
  buildContribuicoesRows,
  buildMetasRows,
  CONTRIBUICOES_WIDTHS,
  METAS_WIDTHS,
} from './metas'

export interface ExportSheet {
  name: string
  filename: string
  data: SheetData
  widths: number[]
}

const EXTRATO_WIDTHS = [12, 16, 40, 14, 20, 18, 10, 20]
const SALDOS_WIDTHS = [24, 26, 16, 14, 16]
const LANCAMENTOS_WIDTHS = [24, 12, 14, 40, 14, 18, 14, 30]

/**
 * Coleta a conta inteira. Sem teto de linhas, ao contrário de /extrato e
 * /devedores: ali o usuário pode estreitar o recorte e tentar de novo, aqui não
 * existe filtro nenhum — recusar deixaria sem saída justamente quem tem mais
 * dados. A ausência do EXPORT_ROW_LIMIT é deliberada; não "consertar".
 */
export async function collectFullExport(userId: string): Promise<ExportSheet[]> {
  const hoje = todayISOString()
  const earliest = await getEarliestActivityDate(userId)

  const [
    items,
    accounts,
    groups,
    overrides,
    installments,
    types,
    entries,
    withdrawals,
    goals,
    people,
    debtorEntries,
  ] = await Promise.all([
    collectHistoricoItems(userId, {
      de: earliest ?? hoje,
      ate: hoje,
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
    }),
    getPaymentAccounts(userId),
    getCategoriesWithGroups(userId),
    getAllBudgetOverrides(userId),
    getAllInstallmentGroups(userId),
    getInvestmentTypes(userId),
    getAllInvestmentEntries(userId),
    getAllInvestmentWithdrawals(userId),
    getGoalsWithProgress(userId),
    getPeopleWithBalances(userId),
    getAllDebtorEntries(userId),
  ])

  return [
    { name: 'Extrato', filename: '01-extrato', data: buildExtratoRows(items), widths: EXTRATO_WIDTHS },
    { name: 'Contas', filename: '02-contas', data: buildContasRows(accounts), widths: CONTAS_WIDTHS },
    {
      name: 'Categorias',
      filename: '03-categorias',
      data: buildCategoriasRows(groups),
      widths: CATEGORIAS_WIDTHS,
    },
    {
      name: 'Orçamentos mensais',
      filename: '04-orcamentos-mensais',
      data: buildOrcamentosRows(overrides),
      widths: ORCAMENTOS_WIDTHS,
    },
    {
      name: 'Parcelas',
      filename: '05-parcelas',
      data: buildParcelasRows(installments),
      widths: PARCELAS_WIDTHS,
    },
    {
      name: 'Investimentos — Tipos',
      filename: '06-investimentos-tipos',
      data: buildTiposRows(types),
      widths: TIPOS_WIDTHS,
    },
    {
      name: 'Investimentos — Aportes',
      filename: '07-investimentos-aportes',
      data: buildAportesRows(entries),
      widths: APORTES_WIDTHS,
    },
    {
      name: 'Investimentos — Resgates',
      filename: '08-investimentos-resgates',
      data: buildResgatesRows(withdrawals),
      widths: RESGATES_WIDTHS,
    },
    { name: 'Metas', filename: '09-metas', data: buildMetasRows(goals), widths: METAS_WIDTHS },
    {
      name: 'Metas — Contribuições',
      filename: '10-metas-contribuicoes',
      data: buildContribuicoesRows(goals),
      widths: CONTRIBUICOES_WIDTHS,
    },
    {
      name: 'Devedores — Saldos',
      filename: '11-devedores-saldos',
      data: buildSaldosRows(people),
      widths: SALDOS_WIDTHS,
    },
    {
      name: 'Devedores — Lançamentos',
      filename: '12-devedores-lancamentos',
      data: buildLancamentosRows(debtorEntries),
      widths: LANCAMENTOS_WIDTHS,
    },
  ]
}
```

`ALL_TIPOS` já é exportado por `lib/utils/historico-params.ts:5` e é a mesma lista que alimenta o
tipo `TipoKind`. Reusá-la, nunca reescrever a literal aqui: um `TipoKind` novo passaria a faltar no
dump em silêncio, e nenhum teste acusaria.

- [ ] **Step 4: Rodar e ver passar**

```bash
npm run test:integration -- export-completo
```

Esperado: PASS, 3 testes.

- [ ] **Step 5: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/export/full/collect.ts lib/utils/historico-params.ts __tests__/integration/export-completo.test.ts
git commit -m "feat(export): coletor da exportação completa"
```

---

### Task 10: Rota `/api/export/completo`

**Files:**
- Create: `lib/export/full/xlsx.ts`
- Create: `app/api/export/completo/route.ts`
- Test: `__tests__/integration/export-completo.test.ts` (append)

**Interfaces:**
- Consumes: `collectFullExport` (Task 9), `createZip`/`toZipResponse` (Task 1), `sheetToCsv` de `lib/export/csv.ts`, `toXlsxResponse` de `lib/export/xlsx.ts`.
- Produces: `writeFullXlsx(sheets: ExportSheet[]): Promise<Buffer>`; a rota `GET /api/export/completo`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `__tests__/integration/export-completo.test.ts`:

```ts
describe('GET /api/export/completo', () => {
  it('nenhuma célula do dump vaza ciphertext', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')

    const sheets = await collectFullExport(userId)
    const dump = sheets.map((s) => sheetToCsv(s.data)).join('\n')

    expect(dump).not.toMatch(/enc:/)
  })

  it('o dump contém os valores decriptados que foram cifrados no setup', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')

    const sheets = await collectFullExport(userId)
    const dump = sheets.map((s) => sheetToCsv(s.data)).join('\n')

    // Um valor por domínio cifrado no beforeAll — se algum sumir, a query errou
    expect(dump).toContain('Nubank')
    expect(dump).toContain('Mercado')
    expect(dump).toContain('Supermercado')
    expect(dump).toContain('Notebook')
    expect(dump).toContain('CDB')
    expect(dump).toContain('Reserva')
    expect(dump).toContain('João')
  })

  it('o ZIP tem um csv por planilha, com prefixo numérico', async () => {
    const { unzipSync } = await import('fflate')
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')
    const { createZip } = await import('@/lib/export/zip')

    const sheets = await collectFullExport(userId)
    const buffer = createZip(
      sheets.map((s) => ({ name: `${s.filename}.csv`, content: sheetToCsv(s.data) }))
    )

    const names = Object.keys(unzipSync(new Uint8Array(buffer)))
    expect(names).toHaveLength(12)
    expect(names).toContain('01-extrato.csv')
    expect(names).toContain('12-devedores-lancamentos.csv')
  })

  it('o xlsx sai como buffer não-vazio com assinatura de zip', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { writeFullXlsx } = await import('@/lib/export/full/xlsx')

    const buffer = await writeFullXlsx(await collectFullExport(userId))

    expect(buffer.length).toBeGreaterThan(0)
    expect(Array.from(buffer.subarray(0, 2))).toEqual([0x50, 0x4b]) // "PK"
  })
})
```

O segundo teste é o par obrigatório do primeiro: sozinho, `not.toMatch(/enc:/)` também passa num dump vazio.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm run test:integration -- export-completo
```

Esperado: FAIL — `Failed to resolve import "@/lib/export/full/xlsx"`.

- [ ] **Step 3: Implementar o escritor XLSX**

```ts
// lib/export/full/xlsx.ts
import writeXlsxFile from 'write-excel-file/node'
import type { ExportSheet } from './collect'

export function writeFullXlsx(sheets: ExportSheet[]): Promise<Buffer> {
  return writeXlsxFile(
    sheets.map((sheet) => ({
      sheet: sheet.name,
      stickyRowsCount: 1,
      columns: sheet.widths.map((width) => ({ width })),
      data: sheet.data,
    })),
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}
```

- [ ] **Step 4: Implementar a rota**

```ts
// app/api/export/completo/route.ts
import { auth } from '@/lib/auth'
import { sheetToCsv, toCsvResponse } from '@/lib/export/csv'
import { collectFullExport } from '@/lib/export/full/collect'
import { writeFullXlsx } from '@/lib/export/full/xlsx'
import { toXlsxResponse } from '@/lib/export/xlsx'
import { createZip, toZipResponse } from '@/lib/export/zip'
import { todayISOString } from '@/lib/utils/date'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const isCsv = new URL(req.url).searchParams.get('format') === 'csv'
  const sheets = await collectFullExport(session.user.id)
  const filename = `mare-completo-${todayISOString()}`

  if (isCsv) {
    const buffer = createZip(
      sheets.map((sheet) => ({
        name: `${sheet.filename}.csv`,
        content: sheetToCsv(sheet.data),
      }))
    )
    return toZipResponse(buffer, `${filename}.zip`)
  }

  return toXlsxResponse(await writeFullXlsx(sheets), `${filename}.xlsx`)
}
```

O import de `toCsvResponse` não é usado — remover da linha de import. O hook `PostToolUse:Edit` do projeto bloqueia edits com imports não usados; se isso disparar, reescrever o arquivo inteiro com `Write`.

- [ ] **Step 5: Rodar e ver passar**

```bash
npm run test:integration -- export-completo
```

Esperado: PASS, 7 testes no arquivo.

- [ ] **Step 6: Medir tamanho e latência (item aberto da spec)**

```bash
npm run dev
```

Autenticado no browser, baixar `/api/export/completo` e `/api/export/completo?format=csv`. Anotar tamanho de cada arquivo e o tempo de resposta da aba Network.

Registrar os dois números na seção "Riscos" da spec, substituindo os "**Ação:** medir" pelos valores medidos. Se a latência passar de ~5 s, parar e reportar — o próximo passo seria o job assíncrono que a spec deixou fora de escopo, e isso é decisão de produto, não de implementação.

- [ ] **Step 7: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add lib/export/full/xlsx.ts app/api/export/completo/route.ts docs/superpowers/specs/2026-08-13-exportacao-completa-design.md __tests__/integration/export-completo.test.ts
git commit -m "feat(export): rota /api/export/completo em xlsx e zip"
```

---

### Task 11: UI — seção "Seus dados" no SettingsDialog

**Files:**
- Modify: `components/settings/SettingsDialog.tsx:48-128`

**Interfaces:**
- Consumes: a rota da Task 10.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Adicionar a seção**

Em `SettingsContent`, inserir entre o bloco "Privacidade" (termina na linha 67) e o bloco "Zona de perigo" (começa na linha 69):

```tsx
      <div>
        <p className="mb-1 text-small font-semibold text-text-primary">Seus dados</p>
        <p className="mb-3 text-small text-text-secondary">
          Baixa tudo o que está na sua conta — lançamentos, categorias, contas, parcelas,
          investimentos, metas e devedores. Sem filtro de período.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export/completo" download>
              <Download className="h-4 w-4" />
              Excel (.xlsx)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/completo?format=csv" download>
              <Download className="h-4 w-4" />
              CSV (.zip)
            </a>
          </Button>
        </div>
      </div>
```

Adicionar `Download` ao import de `lucide-react` na linha 7:

```tsx
import { Download, RotateCcw, TriangleAlert } from 'lucide-react'
```

A seção vai **antes** da "Zona de perigo" de propósito: quem está prestes a resetar a conta encontra a saída de dados antes do botão vermelho.

O `<Button>` do DS suporta `asChild` — o `<a>` recebe o estilo sem JS de download. `gap-2` já vem do `Button`; se o ícone ficar colado, conferir a variante antes de adicionar classe.

- [ ] **Step 2: Verificar no browser**

```bash
npm run dev
```

Abrir o app, clicar em Configurações, conferir que a seção aparece entre Privacidade e Zona de perigo, nos dois temas (claro e escuro), e que os dois botões baixam arquivo.

Conferir também no Drawer mobile (viewport < 1024px), onde o conteúdo é o mesmo componente.

- [ ] **Step 3: Rodar o ds-reviewer**

O hook `PostToolUse` dispara sozinho ao salvar. Se apontar violação, corrigir antes de commitar — em especial valores arbitrários de Tailwind, que a Regra 3 do DS proíbe.

- [ ] **Step 4: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add components/settings/SettingsDialog.tsx
git commit -m "feat(export): seção Seus dados no SettingsDialog"
```

---

### Task 12: Fechar a promessa da landing

**Files:**
- Modify: `app/(marketing)/page.tsx:78`
- Modify: `components/marketing/FaqSection.tsx:19`
- Modify: `docs/seo-landing-backlog.md` §6.1

**Interfaces:**
- Consumes: a rota da Task 10 no ar.
- Produces: nada.

- [ ] **Step 1: Ler os dois comentários antes de mexer**

```bash
grep -rn "PROMESSA SEM LASTRO" -A 6 app/\(marketing\)/page.tsx components/marketing/FaqSection.tsx
```

**Os dois comentários cobrem as duas promessas.** Nenhum dos dois é removido nesta task — os dois são
reescritos para falar só da exclusão de conta. Remover qualquer um deles é o erro fácil aqui:
deixaria a promessa que continua falsa sem rastreamento nenhum.

- [ ] **Step 2: Reescrever o comentário de `page.tsx`**

Substituir o bloco de comentário em `app/(marketing)/page.tsx:78-81` por:

```tsx
    /* PROMESSA SEM LASTRO — segunda ocorrência, ver docs/seo-landing-backlog.md
       §6.1 e o comentário em FaqSection.tsx. "Exporte tudo em CSV" já tem
       lastro (/api/export/completo). "Apague a conta" não: `resetAccount` limpa
       os dados e mantém o usuário, que é outra coisa. Quem for corrigir a copy
       precisa mexer nos dois pontos: o FAQ e aqui. */
```

A copy visível (`body`) **não muda** — a metade sobre exportação passou a ser verdade.

- [ ] **Step 3: Reescrever o comentário de `FaqSection.tsx`**

Substituir o bloco em `components/marketing/FaqSection.tsx:19-26` por:

```tsx
    /* PROMESSA SEM LASTRO — ver docs/seo-landing-backlog.md §6.1.
       "exportar tudo em CSV": resolvido em /api/export/completo, que cobre as 12
       planilhas da conta em .xlsx e .zip de CSVs.
       "apagar sua conta": ainda não existe. `resetAccount` limpa os dados e
       mantém o usuário — que é outra coisa, e não é o que esta frase promete.
       Enquanto ela não subir, metade desta resposta é afirmação falsa em
       produção. Remover este comentário só quando a exclusão de conta existir. */
```

Reparar que a última linha do comentário original dizia *"Ao implementar, remover este comentário"*.
Seguir essa instrução ao pé da letra agora seria apagar o único rastro da promessa que segue falsa —
por isso ela é substituída junto.

- [ ] **Step 4: Atualizar o backlog**

Em `docs/seo-landing-backlog.md`, tabela da §6.1: a linha "Exportação completa" sai de **parcial** para **resolvida**, e a coluna "O que falta" passa a apontar a rota `/api/export/completo`. A linha "Exclusão de conta" fica intacta.

- [ ] **Step 5: Confirmar que sobrou exatamente um marcador**

```bash
grep -rn "PROMESSA SEM LASTRO" app components
```

Esperado: **2** ocorrências — uma em cada arquivo, ambas falando só de exclusão de conta. A contagem
não muda nesta task; o que muda é o texto dos dois comentários.

- [ ] **Step 6: Gate e commit**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add app/\(marketing\)/page.tsx components/marketing/FaqSection.tsx docs/seo-landing-backlog.md
git commit -m "docs: exportação completa deixa de ser promessa sem lastro"
```

---

## Notas de verificação final

Antes de abrir o PR:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:integration
```

O PR deve declarar, no corpo:

- Os dois números medidos na Task 10, Step 6 (tamanho do dump e latência).
- Que a linha "Exclusão de conta" da §6.1 **continua aberta** — este trabalho fecha só uma das duas promessas da landing.
