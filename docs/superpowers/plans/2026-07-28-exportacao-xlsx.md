# Exportação de extrato em XLSX — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir baixar os lançamentos do Maré em `.xlsx`, com células tipadas, a partir de cinco telas.

**Architecture:** Duas rotas `GET` em `app/api/export/` geram o arquivo em memória e devolvem
`Content-Disposition: attachment`. Os botões são `<a download>` renderizados por Server Components.
Os construtores de linha ficam em `lib/export/`, separados em função pura (regra) e escritor (I/O),
para que a regra seja testável sem banco.

**Tech Stack:** Next.js 16 App Router · Drizzle · `write-excel-file@4.1.1` · Vitest

**Spec:** `docs/superpowers/specs/2026-07-28-exportacao-xlsx-design.md`

## Global Constraints

- Versões de dependência **fixas**, sem `^` ou `~` — é a convenção de todo o `package.json`.
- `write-excel-file` **não tem export raiz**. O `exports` do pacote expõe apenas `./node`, `./browser`,
  `./universal` e `./utility`. Sempre importar de `write-excel-file/node`, inclusive os tipos.
- Import de tipo em `lib/export/*`: usar `import type { ... } from 'write-excel-file/node'`. Isso é
  apagado na compilação, então os testes unitários não carregam a maquinaria de zip.
- **Nunca** usar `import { type X }` — o ESLint do projeto roda com `--max-warnings 0` e essa forma
  gera falso positivo. Usar `import type { X }` como linha separada.
- Datas: converter `YYYY-MM-DD` com `parseDate()` de `@/lib/utils/date` (que aplica `T12:00:00`).
  Verificado: o serial gerado cai no dia correto; construir `new Date(str)` direto desloca o dia.
- Valores monetários vêm do banco como string decriptada — sempre `toAmount()` de
  `@/lib/utils/currency`, nunca `Number(x)`.
- Rótulos e mensagens ao usuário em **pt-BR**.
- Antes de qualquer commit: `npm run lint && npm run format:check && npm run typecheck && npm test`.
- Componentes seguem o DS Maré (`.claude/ds-components.md`): nada de HTML cru onde existe primitivo,
  zero valores arbitrários de Tailwind.

## Descobertas de verificação que este plano assume

Três coisas foram checadas contra o código/pacote real e mudam o que o spec descrevia:

1. **O botão do `/historico` é Server Component, não Client.** O spec supôs que os filtros viviam no
   estado do componente. Eles vivem na URL: `app/(app)/historico/page.tsx` já tem `params` pronto no
   servidor. Os cinco botões são Server Components.
2. **`<Button asChild>` está quebrado hoje** e precisa de correção na Task 5 (detalhes lá).
3. **A aba "Saldos" não terá coluna "Situação".** `getPeopleWithBalances` filtra
   `archived = false`, então a coluna seria a constante "Ativo".

---

### Task 1: Dependência e encanamento compartilhado de XLSX

**Files:**
- Modify: `package.json` (bloco `dependencies`)
- Create: `lib/export/xlsx.ts`
- Test: `__tests__/unit/export-xlsx.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `EXPORT_ROW_LIMIT: number`
  - `headerRow(labels: string[]): Row`
  - `textCell(value: string | null): Cell`
  - `dateCell(dateStr: string): Cell`
  - `moneyCell(value: number): Cell`
  - `slugifyForFilename(value: string): string`
  - `toXlsxResponse(buffer: Buffer, filename: string): Response`
  - `tooManyRowsResponse(): Response`

- [ ] **Step 1: Instalar a dependência em versão fixa**

```bash
npm install --save-exact write-excel-file@4.1.1
```

Confirme que o `package.json` ficou com `"write-excel-file": "4.1.1"` — sem `^`.

- [ ] **Step 2: Escrever o teste que falha**

Crie `__tests__/unit/export-xlsx.test.ts`:

```ts
// __tests__/unit/export-xlsx.test.ts
import { describe, it, expect } from 'vitest'
import {
  dateCell,
  moneyCell,
  headerRow,
  slugifyForFilename,
  textCell,
  toXlsxResponse,
  tooManyRowsResponse,
} from '@/lib/export/xlsx'

describe('textCell', () => {
  it('converte null em string vazia', () => {
    expect(textCell(null)).toEqual({ value: '', type: String })
  })

  it('preserva o texto', () => {
    expect(textCell('Mercado')).toEqual({ value: 'Mercado', type: String })
  })
})

describe('dateCell', () => {
  it('emite uma Date real, no dia correto, e não texto', () => {
    const cell = dateCell('2026-07-10')
    expect(cell).toMatchObject({ type: Date, format: 'dd/mm/yyyy' })
    const value = (cell as { value: Date }).value
    expect(value).toBeInstanceOf(Date)
    expect(value.getFullYear()).toBe(2026)
    expect(value.getMonth()).toBe(6) // julho é 6
    expect(value.getDate()).toBe(10)
  })
})

describe('moneyCell', () => {
  it('emite número com formato de duas casas', () => {
    expect(moneyCell(-123.45)).toEqual({
      value: -123.45,
      type: Number,
      format: '#,##0.00',
    })
  })
})

describe('headerRow', () => {
  it('marca todas as células como negrito', () => {
    const row = headerRow(['Data', 'Valor'])
    expect(row).toEqual([
      { value: 'Data', type: String, fontWeight: 'bold' },
      { value: 'Valor', type: String, fontWeight: 'bold' },
    ])
  })
})

describe('slugifyForFilename', () => {
  it('remove acentuação e normaliza separadores', () => {
    expect(slugifyForFilename('João da Silva')).toBe('joao-da-silva')
  })

  it('remove aspas, que quebrariam o Content-Disposition', () => {
    expect(slugifyForFilename('Ana "Nina" Souza')).toBe('ana-nina-souza')
  })

  it('não deixa hífen sobrando nas pontas', () => {
    expect(slugifyForFilename('  Zé  ')).toBe('ze')
  })
})

describe('toXlsxResponse', () => {
  it('devolve os headers de download com o nome do arquivo', () => {
    const res = toXlsxResponse(Buffer.from('abc'), 'mare-extrato.xlsx')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="mare-extrato.xlsx"'
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

describe('tooManyRowsResponse', () => {
  it('responde 413 com mensagem legível em pt-BR', async () => {
    const res = tooManyRowsResponse()
    expect(res.status).toBe(413)
    await expect(res.text()).resolves.toContain('Período muito grande')
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

```bash
npm test -- export-xlsx
```

Esperado: FAIL com erro de resolução — `Failed to resolve import "@/lib/export/xlsx"`.

- [ ] **Step 4: Implementar `lib/export/xlsx.ts`**

```ts
// lib/export/xlsx.ts
import type { Cell, Row } from 'write-excel-file/node'
import { parseDate } from '@/lib/utils/date'

/**
 * Teto de linhas por exportação. Acima disso a rota recusa em vez de truncar:
 * um arquivo truncado em silêncio seria usado para conferir totais e daria
 * números errados sem nenhum sinal.
 */
export const EXPORT_ROW_LIMIT = 20_000

export function textCell(value: string | null): Cell {
  return { value: value ?? '', type: String }
}

export function dateCell(dateStr: string): Cell {
  return { value: parseDate(dateStr), type: Date, format: 'dd/mm/yyyy' }
}

export function moneyCell(value: number): Cell {
  return { value, type: Number, format: '#,##0.00' }
}

export function headerRow(labels: string[]): Row {
  return labels.map((value) => ({ value, type: String, fontWeight: 'bold' }))
}

/** Normaliza um nome para uso seguro dentro de Content-Disposition. */
export function slugifyForFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function toXlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function tooManyRowsResponse(): Response {
  return new Response(
    'Período muito grande para exportar — reduza o intervalo ou os filtros.',
    { status: 413, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  )
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
npm test -- export-xlsx
```

Esperado: PASS, 10 testes.

- [ ] **Step 6: Rodar os gates e commitar**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add package.json package-lock.json lib/export/xlsx.ts __tests__/unit/export-xlsx.test.ts
git commit -m "feat(export): encanamento de geração de XLSX"
```

---

### Task 2: Extrair `collectHistoricoItems`

Separa a busca do feed da paginação, para que a exportação percorra exatamente o mesmo caminho
que alimenta a tela.

**Files:**
- Modify: `lib/queries/historico.ts:60-283` (a função `getHistoricoFeed`)

**Interfaces:**
- Consumes: `HistoricoParams`, `HistoricoFeedItem` (já existem no arquivo).
- Produces: `collectHistoricoItems(userId: string, params: HistoricoParams): Promise<HistoricoFeedItem[]>`

- [ ] **Step 1: Renomear a função existente e mudar seu retorno**

Em `lib/queries/historico.ts`, troque a assinatura de `getHistoricoFeed` por:

```ts
export async function collectHistoricoItems(
  userId: string,
  params: HistoricoParams
): Promise<HistoricoFeedItem[]> {
```

O corpo permanece **idêntico** até a linha que hoje define `sorted`. Substitua todo o bloco final
de paginação (de `// Cursor-based pagination` até o `return`) por:

```ts
  return sorted
}
```

- [ ] **Step 2: Recriar `getHistoricoFeed` como camada fina de paginação**

Logo abaixo, adicione:

```ts
export async function getHistoricoFeed(
  userId: string,
  params: HistoricoParams
): Promise<{ items: HistoricoFeedItem[]; hasMore: boolean; nextCursor: string | null }> {
  const sorted = await collectHistoricoItems(userId, params)

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
```

Mantenha `export type HistoricoFeedResult = Awaited<ReturnType<typeof getHistoricoFeed>>` no fim
do arquivo, inalterado.

- [ ] **Step 3: Verificar que nada quebrou**

```bash
npm run typecheck && npm test && npm run lint
```

Esperado: typecheck limpo e todos os testes passando, incluindo
`__tests__/unit/historico-merge.test.ts`.

Nota honesta sobre cobertura: os testes unitários do projeto só cobrem os helpers puros deste
arquivo (`mergeAndSortFeedItems`, `fixedExpenseDate`, `referenceMonthsInRange`) — `getHistoricoFeed`
toca o banco e não tem teste unitário. A rede de segurança aqui é a extração ser puramente mecânica
(nenhuma linha de lógica alterada) mais o typecheck. Não invente um teste com banco mockado para
este passo.

- [ ] **Step 4: Verificar no app rodando**

```bash
npm run dev
```

Abra `/historico`, role até o fim da lista e clique em carregar mais. Confirme que a paginação
continua trazendo itens novos sem repetir.

- [ ] **Step 5: Commitar**

```bash
git add lib/queries/historico.ts
git commit -m "refactor(historico): extrai collectHistoricoItems de getHistoricoFeed"
```

---

### Task 3: Construtor de linhas do extrato

**Files:**
- Create: `lib/export/extrato-xlsx.ts`
- Test: `__tests__/unit/export-extrato.test.ts`

**Interfaces:**
- Consumes: `headerRow`, `textCell`, `dateCell`, `moneyCell` de `@/lib/export/xlsx`;
  `HistoricoFeedItem` e `TipoKind`.
- Produces:
  - `EXTRATO_HEADERS: string[]`
  - `signedAmount(item: HistoricoFeedItem): number`
  - `formatParcela(item: HistoricoFeedItem): string`
  - `buildExtratoRows(items: HistoricoFeedItem[]): SheetData`
  - `writeExtratoXlsx(items: HistoricoFeedItem[]): Promise<Buffer>`

- [ ] **Step 1: Escrever o teste que falha**

Crie `__tests__/unit/export-extrato.test.ts`:

```ts
// __tests__/unit/export-extrato.test.ts
import { describe, it, expect } from 'vitest'
import {
  EXTRATO_HEADERS,
  buildExtratoRows,
  formatParcela,
  signedAmount,
} from '@/lib/export/extrato-xlsx'
import type { HistoricoFeedItem } from '@/lib/queries/historico'

function makeItem(overrides: Partial<HistoricoFeedItem>): HistoricoFeedItem {
  return {
    id: 'id-1',
    kind: 'saida_avulsa',
    name: 'Item',
    amount: '100.00',
    date: '2026-06-10',
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

describe('signedAmount', () => {
  it('torna saídas negativas', () => {
    expect(signedAmount(makeItem({ kind: 'saida_avulsa' }))).toBe(-100)
    expect(signedAmount(makeItem({ kind: 'saida_fixa' }))).toBe(-100)
    expect(signedAmount(makeItem({ kind: 'saida_parcelada' }))).toBe(-100)
  })

  it('torna aportes negativos, seguindo o dashboard que subtrai investido do saldo', () => {
    expect(signedAmount(makeItem({ kind: 'investimento' }))).toBe(-100)
  })

  it('mantém entradas e resgates positivos', () => {
    expect(signedAmount(makeItem({ kind: 'entrada' }))).toBe(100)
    expect(signedAmount(makeItem({ kind: 'resgate' }))).toBe(100)
  })

  it('somar a coluna reproduz o saldo do período', () => {
    const items = [
      makeItem({ kind: 'entrada', amount: '5000.00' }),
      makeItem({ kind: 'saida_avulsa', amount: '1200.50' }),
      makeItem({ kind: 'investimento', amount: '800.00' }),
    ]
    const total = items.reduce((acc, i) => acc + signedAmount(i), 0)
    expect(total).toBeCloseTo(2999.5, 2)
  })
})

describe('formatParcela', () => {
  it('formata número e total', () => {
    expect(
      formatParcela(makeItem({ installmentNumber: 3, totalInstallments: 12 }))
    ).toBe('3/12')
  })

  it('devolve vazio quando não é parcelado', () => {
    expect(formatParcela(makeItem({}))).toBe('')
  })

  it('devolve vazio quando só um dos dois campos está preenchido', () => {
    expect(formatParcela(makeItem({ installmentNumber: 3 }))).toBe('')
    expect(formatParcela(makeItem({ totalInstallments: 12 }))).toBe('')
  })
})

describe('buildExtratoRows', () => {
  it('começa pelo cabeçalho em negrito', () => {
    const rows = buildExtratoRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(EXTRATO_HEADERS.length)
    expect(rows[0][0]).toMatchObject({ value: 'Data', fontWeight: 'bold' })
  })

  it('monta a linha completa de uma saída avulsa', () => {
    const rows = buildExtratoRows([
      makeItem({
        kind: 'saida_avulsa',
        name: 'Mercado',
        amount: '250.75',
        date: '2026-06-10',
        categoryName: 'Alimentação',
        accountName: 'Nubank',
      }),
    ])
    const row = rows[1]
    expect(row[1]).toMatchObject({ value: 'Saída avulsa' })
    expect(row[2]).toMatchObject({ value: 'Mercado' })
    expect(row[3]).toMatchObject({ value: -250.75, type: Number })
    expect(row[4]).toMatchObject({ value: 'Alimentação' })
    expect(row[5]).toMatchObject({ value: 'Nubank' })
    expect(row[6]).toMatchObject({ value: '' })
    expect(row[7]).toMatchObject({ value: '' })
  })

  it('emite a data como Date, não texto', () => {
    const rows = buildExtratoRows([makeItem({ date: '2026-06-10' })])
    expect(rows[1][0]).toMatchObject({ type: Date })
    expect((rows[1][0] as { value: Date }).value).toBeInstanceOf(Date)
  })

  it('deixa categoria e conta vazias quando nulas', () => {
    const rows = buildExtratoRows([
      makeItem({ kind: 'entrada', categoryName: null, accountName: null }),
    ])
    expect(rows[1][4]).toMatchObject({ value: '' })
    expect(rows[1][5]).toMatchObject({ value: '' })
  })

  it('preenche a coluna de investimento em aportes e resgates', () => {
    const rows = buildExtratoRows([
      makeItem({ kind: 'resgate', investmentTypeName: 'CDB Inter' }),
    ])
    expect(rows[1][7]).toMatchObject({ value: 'CDB Inter' })
  })

  it('rotula todos os tipos em pt-BR', () => {
    const kinds = [
      'saida_avulsa',
      'saida_fixa',
      'saida_parcelada',
      'entrada',
      'investimento',
      'resgate',
    ] as const
    const rows = buildExtratoRows(kinds.map((kind) => makeItem({ kind })))
    expect(rows.slice(1).map((r) => (r[1] as { value: string }).value)).toEqual([
      'Saída avulsa',
      'Saída fixa',
      'Saída parcelada',
      'Entrada',
      'Investimento',
      'Resgate',
    ])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npm test -- export-extrato
```

Esperado: FAIL com `Failed to resolve import "@/lib/export/extrato-xlsx"`.

- [ ] **Step 3: Implementar `lib/export/extrato-xlsx.ts`**

```ts
// lib/export/extrato-xlsx.ts
import writeXlsxFile from 'write-excel-file/node'
import type { Row, SheetData } from 'write-excel-file/node'
import type { HistoricoFeedItem } from '@/lib/queries/historico'
import type { TipoKind } from '@/lib/utils/historico-params'
import { toAmount } from '@/lib/utils/currency'
import { dateCell, headerRow, moneyCell, textCell } from './xlsx'

const TIPO_LABELS: Record<TipoKind, string> = {
  saida_avulsa: 'Saída avulsa',
  saida_fixa: 'Saída fixa',
  saida_parcelada: 'Saída parcelada',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

/**
 * Tipos que saem do caixa. Aporte entra aqui por coerência com getDashboardData,
 * que subtrai o total investido do saldo.
 */
const NEGATIVE_KINDS: readonly TipoKind[] = [
  'saida_avulsa',
  'saida_fixa',
  'saida_parcelada',
  'investimento',
]

export const EXTRATO_HEADERS = [
  'Data',
  'Tipo',
  'Descrição',
  'Valor',
  'Categoria',
  'Conta',
  'Parcela',
  'Investimento',
]

const COLUMN_WIDTHS = [
  { width: 12 },
  { width: 16 },
  { width: 40 },
  { width: 14 },
  { width: 20 },
  { width: 18 },
  { width: 10 },
  { width: 20 },
]

export function signedAmount(item: HistoricoFeedItem): number {
  const value = toAmount(item.amount)
  return NEGATIVE_KINDS.includes(item.kind) ? -value : value
}

export function formatParcela(item: HistoricoFeedItem): string {
  if (item.installmentNumber == null || item.totalInstallments == null) return ''
  return `${item.installmentNumber}/${item.totalInstallments}`
}

function toRow(item: HistoricoFeedItem): Row {
  return [
    dateCell(item.date),
    textCell(TIPO_LABELS[item.kind]),
    textCell(item.name),
    moneyCell(signedAmount(item)),
    textCell(item.categoryName),
    textCell(item.accountName),
    textCell(formatParcela(item)),
    textCell(item.investmentTypeName),
  ]
}

export function buildExtratoRows(items: HistoricoFeedItem[]): SheetData {
  return [headerRow(EXTRATO_HEADERS), ...items.map(toRow)]
}

export function writeExtratoXlsx(items: HistoricoFeedItem[]): Promise<Buffer> {
  return writeXlsxFile(
    [
      {
        sheet: 'Extrato',
        stickyRowsCount: 1,
        columns: COLUMN_WIDTHS,
        data: buildExtratoRows(items),
      },
    ],
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm test -- export-extrato
```

Esperado: PASS.

- [ ] **Step 5: Escrever o teste de integração do escritor**

`buildExtratoRows` é puro, mas `writeExtratoXlsx` pode falhar por seleção errada de overload da lib
(a assinatura de múltiplas abas contra a de aba única). Um teste garante que gera um `.xlsx` válido.

Adicione ao fim de `__tests__/unit/export-extrato.test.ts`:

```ts
describe('writeExtratoXlsx', () => {
  it('gera um arquivo xlsx válido com a aba nomeada', async () => {
    const { writeExtratoXlsx } = await import('@/lib/export/extrato-xlsx')
    const buffer = await writeExtratoXlsx([
      makeItem({ kind: 'entrada', name: 'Salário', amount: '5000.00' }),
    ])

    expect(Buffer.isBuffer(buffer)).toBe(true)
    // Assinatura de arquivo ZIP — todo .xlsx é um zip.
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    expect(buffer.length).toBeGreaterThan(1000)
  })
})
```

Adicione o import estático no topo do arquivo de teste junto aos demais.

- [ ] **Step 6: Rodar, verificar gates e commitar**

```bash
npm test -- export-extrato
npm run lint && npm run format:check && npm run typecheck
git add lib/export/extrato-xlsx.ts __tests__/unit/export-extrato.test.ts
git commit -m "feat(export): construtor de linhas do extrato em XLSX"
```

---

### Task 4: Rota `GET /api/export/extrato`

**Files:**
- Create: `app/api/export/extrato/route.ts`

**Interfaces:**
- Consumes: `collectHistoricoItems` (Task 2), `writeExtratoXlsx` (Task 3),
  `EXPORT_ROW_LIMIT` / `toXlsxResponse` / `tooManyRowsResponse` (Task 1),
  `parseHistoricoParams` de `@/lib/utils/historico-params`, `auth` de `@/lib/auth`.
- Produces: rota HTTP `GET /api/export/extrato`, consumida pelos botões da Task 6.

- [ ] **Step 1: Implementar a rota**

```ts
// app/api/export/extrato/route.ts
import { auth } from '@/lib/auth'
import { writeExtratoXlsx } from '@/lib/export/extrato-xlsx'
import { EXPORT_ROW_LIMIT, toXlsxResponse, tooManyRowsResponse } from '@/lib/export/xlsx'
import { collectHistoricoItems } from '@/lib/queries/historico'
import { parseHistoricoParams } from '@/lib/utils/historico-params'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const params = parseHistoricoParams(Object.fromEntries(searchParams))

  const items = await collectHistoricoItems(session.user.id, params)
  if (items.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()

  const buffer = await writeExtratoXlsx(items)
  return toXlsxResponse(buffer, `mare-extrato-${params.de}-a-${params.ate}.xlsx`)
}
```

Notas de revisão para quem implementa:
- `session.user.id` é tipado via `types/next-auth.d.ts`. **Não** escrever `(session.user as ...)`.
- A rota só lê: sem `revalidatePath`, sem `assertOwns*`. O escopo por `userId` já vem da query.
- Não adicionar `export const runtime = 'edge'` — a lib precisa do runtime Node.

- [ ] **Step 2: Verificar o gate de tipos e lint**

```bash
npm run lint && npm run typecheck
```

Esperado: limpo.

- [ ] **Step 3: Testar a rota no app rodando**

```bash
npm run dev
```

Logado, abra no browser:
`http://localhost:3000/api/export/extrato?de=2026-01-01&ate=2026-12-31`

Esperado: download de `mare-extrato-2026-01-01-a-2026-12-31.xlsx`. Abra o arquivo e confirme:
cabeçalho em negrito congelado, a coluna Data reconhecida como data pelo Excel/Numbers, a coluna
Valor somável, saídas negativas.

- [ ] **Step 4: Verificar a rejeição sem sessão**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/export/extrato?de=2026-01-01&ate=2026-12-31"
```

Esperado: `401` (o `curl` não carrega o cookie de sessão).

- [ ] **Step 5: Commitar**

```bash
git add app/api/export/extrato/route.ts
git commit -m "feat(export): rota GET /api/export/extrato"
```

---

### Task 5: Corrigir `Button asChild` e criar o `ExportButton`

**Files:**
- Modify: `components/ui/button.tsx:70-81`
- Modify: `lib/utils/date.ts` (nova função `lastDayOfYearMonth`)
- Modify: `__tests__/unit/date.test.ts` (teste da nova função)
- Create: `components/export/ExportButton.tsx`

**Interfaces:**
- Consumes: `Button` do DS.
- Produces:
  - `lastDayOfYearMonth(yearMonth: string): string`
  - `<ExportButton href={string} label?={string} />` — Server Component

- [ ] **Step 1: Entender o bug antes de mexer**

`Button` hoje sempre embrulha os filhos num Fragment:

```tsx
<Comp ref={ref} className={cls} ...>
  {loading ? <Loader2 /> : (<>{leftIcon}{children}{rightIcon}</>)}
</Comp>
```

Com `asChild`, `Comp` é o `Slot` do Radix. O `SlotClone` faz
`React.cloneElement(children, mergedProps)` — e `children` é o Fragment. React **descarta**
`className` e `disabled` ao clonar um Fragment (o próprio Radix pula o `ref` quando
`children.type === React.Fragment`). Resultado: o elemento filho renderiza **sem estilo nenhum**.

Nenhum código do app usa `<Button asChild>` hoje, então o bug nunca apareceu. Todos os cinco
botões deste plano dependem dele.

- [ ] **Step 2: Corrigir o `Button`**

Em `components/ui/button.tsx`, substitua o `return` do componente por:

```tsx
    // Com asChild, os filhos vão direto para o Slot: embrulhar num Fragment faria
    // o Radix clonar o Fragment e o React descartar className/disabled.
    // Nesse modo o chamador põe o ícone dentro do próprio elemento filho.
    return (
      <Comp ref={ref} className={cls} disabled={disabled || loading} {...props}>
        {asChild ? (
          children
        ) : loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    )
```

- [ ] **Step 3: Adicionar `lastDayOfYearMonth` em `lib/utils/date.ts`**

O dashboard precisa do último dia do mês para montar o intervalo.

Adicione `endOfMonth` ao import existente de `date-fns` no topo do arquivo, e a função:

```ts
/** Returns the last day of a YYYY-MM month as YYYY-MM-DD. */
export function lastDayOfYearMonth(yearMonth: string): string {
  return format(endOfMonth(parseDate(yearMonth + '-01')), 'yyyy-MM-dd')
}
```

**Atenção ao gate de cobertura:** `lib/utils/date.ts` tem threshold de 95% em
`vitest.config.mts`. Adicionar função sem teste derruba a cobertura e **quebra o build**. O próximo
passo é obrigatório.

- [ ] **Step 4: Testar `lastDayOfYearMonth`**

Adicione a `__tests__/unit/date.test.ts` (importe a função no bloco de imports existente):

```ts
describe('lastDayOfYearMonth', () => {
  it('devolve o último dia de um mês de 31 dias', () => {
    expect(lastDayOfYearMonth('2026-07')).toBe('2026-07-31')
  })

  it('devolve o último dia de um mês de 30 dias', () => {
    expect(lastDayOfYearMonth('2026-04')).toBe('2026-04-30')
  })

  it('trata fevereiro em ano comum', () => {
    expect(lastDayOfYearMonth('2026-02')).toBe('2026-02-28')
  })

  it('trata fevereiro em ano bissexto', () => {
    expect(lastDayOfYearMonth('2024-02')).toBe('2024-02-29')
  })
})
```

- [ ] **Step 5: Rodar os testes de data com cobertura**

```bash
npm test -- date
npm run test:coverage -- date
```

Esperado: PASS, e `lib/utils/date.ts` permanecendo acima de 95%.

- [ ] **Step 6: Criar o `ExportButton`**

```tsx
// components/export/ExportButton.tsx
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ExportButtonProps = {
  /** URL da rota de exportação, com os filtros já serializados. */
  href: string
  label?: string
}

export function ExportButton({ href, label = 'Exportar' }: ExportButtonProps) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </a>
    </Button>
  )
}
```

Notas de DS: o ícone vai **dentro** do `<a>`, não via `leftIcon` — com `asChild` o `Button` agora
repassa os filhos crus, e `leftIcon` seria ignorado. O `<span className="hidden sm:inline">` segue a
regra de botão de ação em header, que vira icon-only abaixo de 640px.

- [ ] **Step 7: Rodar os gates e commitar**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add components/ui/button.tsx components/export/ExportButton.tsx lib/utils/date.ts __tests__/unit/date.test.ts
git commit -m "fix(ds): Button asChild descartava className ao clonar Fragment

feat(export): ExportButton e lastDayOfYearMonth"
```

---

### Task 6: Ligar os botões de extrato em panorama, dashboard e histórico

**Files:**
- Modify: `app/(app)/panorama/page.tsx:2` (import) e `:86` (botão desabilitado)
- Modify: `app/(app)/dashboard/page.tsx` (bloco `action` do `MonthSelector`)
- Modify: `app/(app)/historico/page.tsx:45-48` (bloco do header)

**Interfaces:**
- Consumes: `<ExportButton>` (Task 5), rota `/api/export/extrato` (Task 4),
  `lastDayOfYearMonth` (Task 5), `buildHistoricoUrl`/`HistoricoParams`.
- Produces: nada consumido por tarefas posteriores.

- [ ] **Step 1: Panorama — trocar o placeholder desabilitado**

Em `app/(app)/panorama/page.tsx`, remova `Download` do import do `lucide-react` (linha 2) e o import
de `Button` se ele não for usado em mais nenhum lugar do arquivo — confira antes; deixar import não
usado quebra o `lint`. Adicione:

```tsx
import { ExportButton } from '@/components/export/ExportButton'
```

Substitua o botão desabilitado (linha 86) por:

```tsx
<ExportButton href={`/api/export/extrato?de=${year}-01-01&ate=${year}-12-31`} />
```

- [ ] **Step 2: Dashboard — montar o intervalo e adicionar o botão**

Em `app/(app)/dashboard/page.tsx`, adicione aos imports:

```tsx
import { ExportButton } from '@/components/export/ExportButton'
```

e inclua `lastDayOfYearMonth` no import existente de `@/lib/utils/date`.

Logo após a linha que define `isCurrentMonth`, adicione:

```tsx
  // Em visão de ciclo de fatura a tela mostra o ciclo, não o mês de calendário —
  // o recorte exportado tem de seguir a tela.
  const exportRange = cycleRange
    ? { de: cycleRange.start, ate: cycleRange.end }
    : { de: `${month}-01`, ate: lastDayOfYearMonth(month) }
```

No `action` do `MonthSelector`, adicione o botão antes do `PrivacyToggle`:

```tsx
        action={
          <div className="flex items-center gap-1">
            <ExportButton
              href={`/api/export/extrato?de=${exportRange.de}&ate=${exportRange.ate}`}
            />
            <PrivacyToggle />
            <DashboardFAB month={month} />
          </div>
        }
```

Verificado: `billingCycleDateRange` (`lib/utils/date.ts:148`) retorna
`{ start: string; end: string; label: string } | null`, com `start`/`end` já em `YYYY-MM-DD` —
a interpolação acima é segura, sem conversão.

- [ ] **Step 3: Histórico — botão no header com os filtros da tela**

Os filtros do `/historico` vivem na URL, e `page.tsx` já tem `params` pronto no servidor. Não é
preciso Client Component.

Em `app/(app)/historico/page.tsx`, adicione ao topo:

```tsx
import { ExportButton } from '@/components/export/ExportButton'
```

Monte a query string a partir de `params`, logo antes do `return`:

```tsx
  const exportQuery = new URLSearchParams({
    de: params.de,
    ate: params.ate,
    tipos: params.tipos.join(','),
  })
  if (params.categorias.length > 0) exportQuery.set('categorias', params.categorias.join(','))
  if (params.contas.length > 0) exportQuery.set('contas', params.contas.join(','))
  if (params.q) exportQuery.set('q', params.q)
```

E troque o bloco do header (linhas 45-48) por:

```tsx
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Histórico" description="Todas as movimentações" />
        <div className="flex flex-shrink-0 items-center gap-2">
          <ExportButton href={`/api/export/extrato?${exportQuery.toString()}`} />
          <PrivacyToggle />
        </div>
      </div>
```

Note que `tipos` é sempre enviado, mesmo quando todos estão selecionados — diferente de
`buildHistoricoUrl`, que o omite nesse caso. Enviar sempre é explícito e o `parseHistoricoParams`
trata ambos igual.

- [ ] **Step 4: Verificar as três telas no browser**

```bash
npm run dev
```

- `/panorama` — o botão antes desabilitado agora baixa o ano inteiro.
- `/dashboard` — baixa o mês; troque de mês e confirme que o arquivo acompanha.
- `/dashboard?cycleAccount=<id de cartão com closingDay>` — confirme que o arquivo cobre o ciclo,
  e não o mês de calendário.
- `/historico` — aplique filtro de categoria e de busca, exporte, e confirme que o arquivo tem
  exatamente as linhas da tela.

Confirme também que o botão está **estilizado** nas três (é o teste visual da correção da Task 5) e
que some o texto "Exportar" abaixo de 640px de largura, restando só o ícone.

- [ ] **Step 5: Rodar os gates e commitar**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add "app/(app)/panorama/page.tsx" "app/(app)/dashboard/page.tsx" "app/(app)/historico/page.tsx"
git commit -m "feat(export): botões de exportar extrato em panorama, dashboard e histórico"
```

---

### Task 7: Query `getAllDebtorEntries`

**Files:**
- Modify: `lib/queries/debtors.ts` (adicionar ao fim do arquivo)

**Interfaces:**
- Consumes: `db`, `debtorEntries`, `people`, `getDekForUser`, `decryptField`, `decryptOptional`,
  `toAmount` — todos já importados no arquivo.
- Produces:
  ```ts
  export type DebtorEntryExportRow = {
    personName: string
    type: 'charge' | 'payment' | 'adjustment'
    amount: number
    description: string
    referenceMonth: string
    entryDate: string
    status: string | null
    notes: string | null
  }
  export async function getAllDebtorEntries(userId: string): Promise<DebtorEntryExportRow[]>
  ```

- [ ] **Step 1: Implementar a query**

Chamar `getPersonDebtDetails` em laço seria N queries. Além disso, os campos são cifrados pela DEK,
então `JOIN`/`GROUP BY` sobre eles no SQL não funcionaria — a junção tem de ser em JS
(ver `.claude/crypto.md`).

Adicione ao fim de `lib/queries/debtors.ts`:

```ts
export type DebtorEntryExportRow = {
  personName: string
  type: 'charge' | 'payment' | 'adjustment'
  amount: number
  description: string
  referenceMonth: string
  entryDate: string
  status: string | null
  notes: string | null
}

export async function getAllDebtorEntries(userId: string): Promise<DebtorEntryExportRow[]> {
  const [personRows, entryRows, dek] = await Promise.all([
    db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(eq(people.userId, userId)),
    db
      .select({
        personId: debtorEntries.personId,
        type: debtorEntries.type,
        amount: debtorEntries.amount,
        description: debtorEntries.description,
        referenceMonth: debtorEntries.referenceMonth,
        entryDate: debtorEntries.entryDate,
        status: debtorEntries.status,
        notes: debtorEntries.notes,
      })
      .from(debtorEntries)
      .where(eq(debtorEntries.userId, userId)),
    getDekForUser(userId),
  ])

  const nameById = new Map(personRows.map((p) => [p.id, decryptField(p.name, dek)]))

  const rows = entryRows.map((e) => ({
    personName: nameById.get(e.personId) ?? '',
    type: e.type as 'charge' | 'payment' | 'adjustment',
    amount: toAmount(decryptField(e.amount, dek)),
    description: decryptField(e.description, dek),
    referenceMonth: e.referenceMonth,
    entryDate: e.entryDate,
    status: e.status,
    notes: decryptOptional(e.notes, dek),
  }))

  // Ordenação em JS: as colunas são ciphertext, ORDER BY no SQL ordenaria lixo.
  rows.sort((a, b) => {
    const byName = a.personName.localeCompare(b.personName, 'pt-BR')
    if (byName !== 0) return byName
    return b.entryDate.localeCompare(a.entryDate)
  })

  return rows
}
```

Nota: diferente de `getPeopleWithBalances`, esta query **não** filtra `archived = false` — o
histórico de uma pessoa arquivada continua sendo dado do usuário e deve sair na exportação.

Verificado: `debtorEntries.notes` é `text('notes')` — nullable, então `decryptOptional` é o correto
(`decryptField` lança em null). Confirme apenas que `decryptOptional` e `toAmount` já estão nos
imports do arquivo; se `decryptOptional` não estiver, adicione-o ao import existente de
`@/lib/crypto/fields`.

- [ ] **Step 2: Verificar tipos e lint**

```bash
npm run lint && npm run typecheck
```

Esperado: limpo.

- [ ] **Step 3: Commitar**

```bash
git add lib/queries/debtors.ts
git commit -m "feat(devedores): query getAllDebtorEntries para exportação"
```

---

### Task 8: Construtor de linhas de devedores

**Files:**
- Create: `lib/export/devedores-xlsx.ts`
- Test: `__tests__/unit/export-devedores.test.ts`

**Interfaces:**
- Consumes: `headerRow`, `textCell`, `dateCell`, `moneyCell` de `@/lib/export/xlsx`;
  `PersonWithBalance` e `DebtorEntryExportRow` de `@/lib/queries/debtors`.
- Produces:
  - `SALDOS_HEADERS: string[]`, `LANCAMENTOS_HEADERS: string[]`
  - `signedEntryAmount(entry: DebtorEntryExportRow): number`
  - `buildSaldosRows(people: PersonWithBalance[]): SheetData`
  - `buildLancamentosRows(entries: DebtorEntryExportRow[]): SheetData`
  - `writeDevedoresXlsx(people: PersonWithBalance[], entries: DebtorEntryExportRow[]): Promise<Buffer>`
  - `writePessoaXlsx(entries: DebtorEntryExportRow[]): Promise<Buffer>`

- [ ] **Step 1: Escrever o teste que falha**

Crie `__tests__/unit/export-devedores.test.ts`:

```ts
// __tests__/unit/export-devedores.test.ts
import { describe, it, expect } from 'vitest'
import {
  LANCAMENTOS_HEADERS,
  SALDOS_HEADERS,
  buildLancamentosRows,
  buildSaldosRows,
  signedEntryAmount,
} from '@/lib/export/devedores-xlsx'
import type { DebtorEntryExportRow, PersonWithBalance } from '@/lib/queries/debtors'

function makeEntry(overrides: Partial<DebtorEntryExportRow>): DebtorEntryExportRow {
  return {
    personName: 'Ana',
    type: 'charge',
    amount: 100,
    description: 'Jantar',
    referenceMonth: '2026-06-01',
    entryDate: '2026-06-10',
    status: 'open',
    notes: null,
    ...overrides,
  }
}

function makePerson(overrides: Partial<PersonWithBalance>): PersonWithBalance {
  return {
    id: 'p1',
    name: 'Ana',
    email: null,
    phone: null,
    notes: null,
    archived: false,
    balance: 0,
    lastMovement: null,
    ...overrides,
  }
}

describe('signedEntryAmount', () => {
  it('mantém cobrança positiva', () => {
    expect(signedEntryAmount(makeEntry({ type: 'charge', amount: 100 }))).toBe(100)
  })

  it('torna pagamento negativo', () => {
    expect(signedEntryAmount(makeEntry({ type: 'payment', amount: 40 }))).toBe(-40)
  })

  it('mantém ajuste como armazenado, inclusive negativo', () => {
    expect(signedEntryAmount(makeEntry({ type: 'adjustment', amount: -15 }))).toBe(-15)
    expect(signedEntryAmount(makeEntry({ type: 'adjustment', amount: 15 }))).toBe(15)
  })

  it('a soma dos lançamentos de uma pessoa reproduz o saldo dela', () => {
    const entries = [
      makeEntry({ type: 'charge', amount: 100 }),
      makeEntry({ type: 'charge', amount: 50 }),
      makeEntry({ type: 'payment', amount: 40 }),
      makeEntry({ type: 'adjustment', amount: -10 }),
    ]
    const total = entries.reduce((acc, e) => acc + signedEntryAmount(e), 0)
    expect(total).toBe(100)
  })
})

describe('buildSaldosRows', () => {
  it('começa pelo cabeçalho', () => {
    const rows = buildSaldosRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(SALDOS_HEADERS.length)
    expect(rows[0][0]).toMatchObject({ value: 'Pessoa', fontWeight: 'bold' })
  })

  it('monta a linha de uma pessoa com contato e saldo', () => {
    const rows = buildSaldosRows([
      makePerson({
        name: 'Ana',
        email: 'ana@x.com',
        phone: '11999998888',
        balance: 250.5,
        lastMovement: '2026-06-10',
      }),
    ])
    expect(rows[1][0]).toMatchObject({ value: 'Ana' })
    expect(rows[1][1]).toMatchObject({ value: 'ana@x.com' })
    expect(rows[1][2]).toMatchObject({ value: '11999998888' })
    expect(rows[1][3]).toMatchObject({ value: 250.5, type: Number })
    expect(rows[1][4]).toMatchObject({ type: Date })
  })

  it('deixa a célula de último movimento vazia quando não há movimentação', () => {
    const rows = buildSaldosRows([makePerson({ lastMovement: null })])
    expect(rows[1][4]).toMatchObject({ value: '' })
  })

  it('deixa email e telefone vazios quando nulos', () => {
    const rows = buildSaldosRows([makePerson({ email: null, phone: null })])
    expect(rows[1][1]).toMatchObject({ value: '' })
    expect(rows[1][2]).toMatchObject({ value: '' })
  })
})

describe('buildLancamentosRows', () => {
  it('começa pelo cabeçalho', () => {
    const rows = buildLancamentosRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(LANCAMENTOS_HEADERS.length)
  })

  it('rotula os três tipos em pt-BR', () => {
    const rows = buildLancamentosRows([
      makeEntry({ type: 'charge' }),
      makeEntry({ type: 'payment' }),
      makeEntry({ type: 'adjustment' }),
    ])
    expect(rows.slice(1).map((r) => (r[2] as { value: string }).value)).toEqual([
      'Cobrança',
      'Pagamento',
      'Ajuste',
    ])
  })

  it('traduz o status e trata null', () => {
    const rows = buildLancamentosRows([
      makeEntry({ status: 'open' }),
      makeEntry({ status: 'settled' }),
      makeEntry({ status: null }),
    ])
    expect(rows.slice(1).map((r) => (r[6] as { value: string }).value)).toEqual([
      'Em aberto',
      'Quitada',
      '',
    ])
  })

  it('emite data como Date e valor com sinal', () => {
    const rows = buildLancamentosRows([
      makeEntry({ type: 'payment', amount: 40, entryDate: '2026-06-10' }),
    ])
    expect(rows[1][1]).toMatchObject({ type: Date })
    expect(rows[1][4]).toMatchObject({ value: -40, type: Number })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npm test -- export-devedores
```

Esperado: FAIL com `Failed to resolve import "@/lib/export/devedores-xlsx"`.

- [ ] **Step 3: Implementar `lib/export/devedores-xlsx.ts`**

```ts
// lib/export/devedores-xlsx.ts
import writeXlsxFile from 'write-excel-file/node'
import type { Row, SheetData } from 'write-excel-file/node'
import type { DebtorEntryExportRow, PersonWithBalance } from '@/lib/queries/debtors'
import { dateCell, headerRow, moneyCell, textCell } from './xlsx'

const TIPO_LABELS: Record<DebtorEntryExportRow['type'], string> = {
  charge: 'Cobrança',
  payment: 'Pagamento',
  adjustment: 'Ajuste',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Em aberto',
  settled: 'Quitada',
}

export const SALDOS_HEADERS = ['Pessoa', 'Email', 'Telefone', 'Saldo', 'Último movimento']

export const LANCAMENTOS_HEADERS = [
  'Pessoa',
  'Data',
  'Tipo',
  'Descrição',
  'Valor',
  'Mês de referência',
  'Status',
  'Observações',
]

const SALDOS_WIDTHS = [{ width: 24 }, { width: 26 }, { width: 16 }, { width: 14 }, { width: 16 }]

const LANCAMENTOS_WIDTHS = [
  { width: 24 },
  { width: 12 },
  { width: 14 },
  { width: 40 },
  { width: 14 },
  { width: 18 },
  { width: 14 },
  { width: 30 },
]

/**
 * Sinal seguindo a convenção do domínio (balance > 0 = a pessoa deve a você):
 * pagamento abate, cobrança e ajuste somam — o ajuste já vem com sinal próprio.
 * Ver getPeopleWithBalances, que calcula o saldo da mesma forma.
 */
export function signedEntryAmount(entry: DebtorEntryExportRow): number {
  return entry.type === 'payment' ? -entry.amount : entry.amount
}

function saldoRow(person: PersonWithBalance): Row {
  return [
    textCell(person.name),
    textCell(person.email),
    textCell(person.phone),
    moneyCell(person.balance),
    person.lastMovement ? dateCell(person.lastMovement) : textCell(null),
  ]
}

function lancamentoRow(entry: DebtorEntryExportRow): Row {
  return [
    textCell(entry.personName),
    dateCell(entry.entryDate),
    textCell(TIPO_LABELS[entry.type]),
    textCell(entry.description),
    moneyCell(signedEntryAmount(entry)),
    textCell(entry.referenceMonth),
    textCell(entry.status ? (STATUS_LABELS[entry.status] ?? entry.status) : null),
    textCell(entry.notes),
  ]
}

export function buildSaldosRows(people: PersonWithBalance[]): SheetData {
  return [headerRow(SALDOS_HEADERS), ...people.map(saldoRow)]
}

export function buildLancamentosRows(entries: DebtorEntryExportRow[]): SheetData {
  return [headerRow(LANCAMENTOS_HEADERS), ...entries.map(lancamentoRow)]
}

export function writeDevedoresXlsx(
  people: PersonWithBalance[],
  entries: DebtorEntryExportRow[]
): Promise<Buffer> {
  return writeXlsxFile(
    [
      {
        sheet: 'Saldos',
        stickyRowsCount: 1,
        columns: SALDOS_WIDTHS,
        data: buildSaldosRows(people),
      },
      {
        sheet: 'Lançamentos',
        stickyRowsCount: 1,
        columns: LANCAMENTOS_WIDTHS,
        data: buildLancamentosRows(entries),
      },
    ],
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}

export function writePessoaXlsx(entries: DebtorEntryExportRow[]): Promise<Buffer> {
  return writeXlsxFile(
    [
      {
        sheet: 'Lançamentos',
        stickyRowsCount: 1,
        columns: LANCAMENTOS_WIDTHS,
        data: buildLancamentosRows(entries),
      },
    ],
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm test -- export-devedores
```

Esperado: PASS.

- [ ] **Step 5: Adicionar o teste do escritor de duas abas**

Adicione ao fim de `__tests__/unit/export-devedores.test.ts`:

```ts
describe('writeDevedoresXlsx', () => {
  it('gera um xlsx válido com as duas abas', async () => {
    const { writeDevedoresXlsx } = await import('@/lib/export/devedores-xlsx')
    const buffer = await writeDevedoresXlsx([makePerson({ balance: 100 })], [makeEntry({})])

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 2).toString()).toBe('PK')

    // O nome das abas fica em xl/workbook.xml, dentro do zip.
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(new Uint8Array(buffer))
    const workbook = strFromU8(files['xl/workbook.xml'])
    expect(workbook).toContain('Saldos')
    expect(workbook).toContain('Lançamentos')
  })
})
```

`fflate` já vem instalado como dependência do `write-excel-file`, então não precisa de instalação
extra. Se o resolver reclamar por ser dependência transitiva, troque a asserção de abas pela
verificação de assinatura ZIP apenas, e verifique os nomes de aba manualmente no browser na Task 9.

- [ ] **Step 6: Rodar os gates e commitar**

```bash
npm test -- export-devedores
npm run lint && npm run format:check && npm run typecheck
git add lib/export/devedores-xlsx.ts __tests__/unit/export-devedores.test.ts
git commit -m "feat(export): construtor de linhas de devedores em XLSX"
```

---

### Task 9: Rota de devedores e os dois botões

**Files:**
- Create: `app/api/export/devedores/route.ts`
- Modify: `app/(app)/devedores/page.tsx:27-33` (bloco do header)
- Modify: `app/(app)/devedores/[id]/page.tsx:45-52` (bloco do header)

**Interfaces:**
- Consumes: `getAllDebtorEntries` (Task 7), `getPeopleWithBalances` e `getPersonDebtDetails`
  (já existem), `writeDevedoresXlsx` / `writePessoaXlsx` (Task 8), `ExportButton` (Task 5),
  `slugifyForFilename` / `toXlsxResponse` / `EXPORT_ROW_LIMIT` / `tooManyRowsResponse` (Task 1).
- Produces: fecha a feature.

- [ ] **Step 1: Implementar a rota**

```ts
// app/api/export/devedores/route.ts
import { auth } from '@/lib/auth'
import { writeDevedoresXlsx, writePessoaXlsx } from '@/lib/export/devedores-xlsx'
import {
  EXPORT_ROW_LIMIT,
  slugifyForFilename,
  toXlsxResponse,
  tooManyRowsResponse,
} from '@/lib/export/xlsx'
import {
  getAllDebtorEntries,
  getPeopleWithBalances,
  getPersonDebtDetails,
} from '@/lib/queries/debtors'
import { todayISOString } from '@/lib/utils/date'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id
  const personId = new URL(req.url).searchParams.get('pessoa')
  const hoje = todayISOString()

  if (personId) {
    // getPersonDebtDetails já filtra por userId: id de outro usuário devolve null.
    const details = await getPersonDebtDetails(userId, personId)
    if (!details) return new Response('Não encontrado', { status: 404 })

    const entries = details.entries.map((e) => ({
      personName: details.person.name,
      type: e.type,
      amount: e.amount,
      description: e.description,
      referenceMonth: e.referenceMonth,
      entryDate: e.entryDate,
      status: e.status,
      notes: e.notes,
    }))

    const buffer = await writePessoaXlsx(entries)
    const slug = slugifyForFilename(details.person.name)
    return toXlsxResponse(buffer, `mare-devedores-${slug}-${hoje}.xlsx`)
  }

  const [people, entries] = await Promise.all([
    getPeopleWithBalances(userId),
    getAllDebtorEntries(userId),
  ])

  if (entries.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()

  const buffer = await writeDevedoresXlsx(people, entries)
  return toXlsxResponse(buffer, `mare-devedores-${hoje}.xlsx`)
}
```

Verificado: `todayISOString()` (`lib/utils/date.ts:47`) devolve `format(new Date(), 'yyyy-MM-dd')`,
exatamente o formato usado no nome do arquivo.

- [ ] **Step 2: Verificar tipos**

```bash
npm run typecheck
```

Esperado: limpo. Verificado: `DebtEntryDetail['type']` (`lib/queries/debtors.ts:94`) já é o union
`'charge' | 'payment' | 'adjustment'`, o mesmo de `DebtorEntryExportRow` — o `map` acima tipa sem
cast.

- [ ] **Step 3: Botão na lista de devedores**

Em `app/(app)/devedores/page.tsx`, adicione o import e troque o bloco do header por:

```tsx
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Devedores"
          description="Acompanhe valores que outras pessoas devem a você."
        />
        <div className="flex flex-shrink-0 items-center gap-2">
          <ExportButton href="/api/export/devedores" />
          <PersonDialog mode="create" />
        </div>
      </div>
```

- [ ] **Step 4: Botão na tela do devedor**

Em `app/(app)/devedores/[id]/page.tsx`, adicione o import e troque o bloco do header por:

```tsx
      <div className="group flex items-start justify-between gap-4">
        <PageHeader title={person.name} description={person.email ?? person.phone ?? undefined} />
        <div className="flex flex-shrink-0 items-center gap-2">
          <ExportButton href={`/api/export/devedores?pessoa=${person.id}`} />
          <DevedorDetailActions
            person={person}
            balance={summary.balance}
            openCharges={openCharges}
            pixKey={pixKey}
          />
        </div>
      </div>
```

A `div` externa mantém a classe `group`, exigida pelo `RowActions` usado lá dentro.

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

- `/devedores` — baixe e confirme **duas abas**, "Saldos" e "Lançamentos". Some a coluna Valor de
  uma pessoa na aba Lançamentos e confira que bate com o Saldo dela na aba Saldos. Esse é o teste
  que fecha a feature.
- `/devedores/<id>` — baixe e confirme uma aba só, com os lançamentos daquela pessoa, e o nome do
  arquivo com o slug sem acento.
- Troque o id na URL por um UUID que não é seu e confirme **404**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3000/api/export/devedores?pessoa=00000000-0000-0000-0000-000000000000"
```

Esperado: `401` sem cookie de sessão; `404` se você repetir logado pelo browser.

- [ ] **Step 6: Rodar os gates e commitar**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
git add app/api/export/devedores/route.ts "app/(app)/devedores/page.tsx" "app/(app)/devedores/[id]/page.tsx"
git commit -m "feat(export): exportação de devedores, na lista e por pessoa"
```

- [ ] **Step 7: Verificação final da feature**

```bash
npm run build
```

Esperado: build limpo. Depois confira as cinco telas com o app rodando e marque a feature como
concluída apenas com os cinco arquivos baixados e abertos.
