# Link público de extrato do devedor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar um link público, permanente e revogável por pessoa em `/devedores/[id]`, que abre uma página sem login com as cobranças em aberto daquela pessoa.

**Architecture:** Um token aleatório de 32 bytes vive em duas colunas de `people` — o SHA-256 (`shareTokenHash`, com unique index) serve ao lookup determinístico da rota pública, e o valor cifrado com a DEK do dono (`shareToken`) permite ao dono recopiar a mesma URL. A rota pública fica num route group novo `(share)`, sem `auth()`, sem nav e sem providers, e o `userId` usado nas queries vem sempre da linha encontrada pelo hash — nunca da URL.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon Postgres, Zod, Vitest (unit + integração com neon-testing), Tailwind + DS Maré.

**Spec:** `docs/superpowers/specs/2026-08-12-link-extrato-devedor-design.md`

## Global Constraints

- Antes de cada commit: `npm run lint && npm run format:check && npm run typecheck && npm test`. Nunca usar `--no-verify`.
- Nunca instalar pacotes novos. Tudo aqui usa o que já existe.
- Toda action de mutação segue o padrão de `.claude/auth.md`: `requireUserId()` → `schema.parse` → `assertOwns*` → DB → `revalidatePath`.
- Campos cifrados nunca vão para `ORDER BY`, `SUM`, `GROUP BY` ou `ILIKE`. `decryptOptional` para campo nullable, `decryptField` só para not-null.
- Valores monetários vindos de coluna `decimal`/`text` passam por `toAmount()`.
- Zero valores arbitrários de Tailwind (`[...]`) onde já existe token do DS. Formulários usam `<Field>`. Ver `.claude/ds-components.md`.
- Commits em Conventional Commits, mensagem em inglês no título.
- Após `db:generate`, rodar `npx prettier --write lib/db/migrations/meta/` — o pre-push hook rejeita a formatação do Drizzle Kit.
- Testes de integração seguem `.claude/testing.md`: `neonTestingSetup()` no escopo global, `createTestDb()` dentro do `beforeAll`, actions importadas por `await import(...)` dentro do `beforeAll`/`it`, e `vi.mock('next/cache')` em todo arquivo que chama action real.

---

### Task 1: Geração e hash do token

Utilitário puro, sem dependência de banco. É a base dos dois lados (action grava, rota pública consulta) e o único ponto onde o formato do token é definido.

**Files:**
- Create: `lib/utils/share-token.ts`
- Modify: `lib/validations/utils.ts` (acrescentar `shareTokenSchema` ao fim do arquivo)
- Create: `__tests__/unit/share-token.test.ts`
- Modify: `vitest.config.mts` (entrada em `thresholds.perFile`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `generateShareToken(): string` — 43 chars base64url
  - `hashShareToken(token: string): string` — 64 chars hex
  - `shareTokenSchema: z.ZodString` — valida o formato antes de qualquer query

- [ ] **Step 1: Escrever o teste falhando**

Criar `__tests__/unit/share-token.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateShareToken, hashShareToken } from '@/lib/utils/share-token'
import { shareTokenSchema } from '@/lib/validations/utils'

describe('generateShareToken', () => {
  it('gera 43 caracteres do alfabeto base64url', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('não repete entre chamadas', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()))
    expect(tokens.size).toBe(50)
  })
})

describe('hashShareToken', () => {
  it('é determinístico para a mesma entrada', () => {
    const token = generateShareToken()
    expect(hashShareToken(token)).toBe(hashShareToken(token))
  })

  it('devolve 64 chars hex', () => {
    expect(hashShareToken('abc')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('difere para entradas diferentes', () => {
    expect(hashShareToken(generateShareToken())).not.toBe(hashShareToken(generateShareToken()))
  })
})

describe('shareTokenSchema', () => {
  it('aceita um token gerado', () => {
    expect(shareTokenSchema.safeParse(generateShareToken()).success).toBe(true)
  })

  it.each([
    ['vazio', ''],
    ['curto demais', 'abc'],
    ['com caractere fora do alfabeto', 'a'.repeat(42) + '+'],
    ['longo demais', 'a'.repeat(44)],
    ['com barra (base64 comum, não base64url)', 'a'.repeat(42) + '/'],
  ])('rejeita %s', (_label, input) => {
    expect(shareTokenSchema.safeParse(input).success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/unit/share-token.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/utils/share-token"`.

- [ ] **Step 3: Implementar o utilitário**

Criar `lib/utils/share-token.ts`:

```ts
import { createHash, randomBytes } from 'crypto'

/**
 * Token de link público de extrato. 32 bytes de entropia em base64url — 43
 * chars, seguro em URL sem escape. O espaço de busca torna enumeração inviável,
 * o que é o motivo de a rota pública não precisar de rate limiting.
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * O lookup precisa ser determinístico e AES-GCM não é (IV aleatório), daí o
 * hash. Guardar o token em texto puro seria o único dado do banco capaz de
 * abrir conteúdo sozinho — ver `.claude/crypto.md`.
 */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
```

- [ ] **Step 4: Adicionar o schema de validação**

Acrescentar ao fim de `lib/validations/utils.ts`:

```ts
/**
 * Formato do token de link público (ver `lib/utils/share-token.ts`). Valida
 * antes de tocar no banco: string crua de URL nunca vai direto para query.
 */
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Link inválido')
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/unit/share-token.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 6: Registrar o threshold de coverage**

Em `vitest.config.mts`, dentro de `coverage.thresholds`, ao lado das entradas existentes de `lib/utils/`:

```ts
        // lib/utils/share-token.ts — geração/hash de token de link público; 100% atingido.
        'lib/utils/share-token.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
```

- [ ] **Step 7: Rodar a suíte com coverage e confirmar o threshold**

Run: `npm run test:coverage`
Expected: PASS, sem erro de threshold para `lib/utils/share-token.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/utils/share-token.ts lib/validations/utils.ts __tests__/unit/share-token.test.ts vitest.config.mts
git commit -m "feat(devedores): add share token generation and hashing"
```

---

### Task 2: Colunas no schema e migration

**Files:**
- Modify: `lib/db/schema.ts` (tabela `people`, por volta da linha 474)
- Create: `lib/db/migrations/<gerado>.sql` + arquivos de meta

**Interfaces:**
- Consumes: nada.
- Produces: colunas `people.shareTokenHash` e `people.shareToken`, ambas `text` nullable; unique index `people_share_token_hash_idx`.

- [ ] **Step 1: Alterar a definição da tabela**

Em `lib/db/schema.ts`, a tabela `people` hoje é `pgTable('people', { ... })` com dois argumentos. Adicionar as duas colunas depois de `archived` e converter para a forma de três argumentos (o terceiro é uma função que devolve um **array**, conforme `.claude/db.md`):

```ts
export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    archived: boolean('archived').default(false).notNull(),
    // Link público de extrato. `shareTokenHash` é o único caminho de lookup
    // (determinístico); `shareToken` guarda o mesmo token cifrado com a DEK do
    // dono, só para reexibir a URL. Um token substituído já é inválido por não
    // bater com nenhum hash — não existe estado "revogado".
    shareTokenHash: text('share_token_hash'),
    shareToken: text('share_token'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('people_share_token_hash_idx').on(t.shareTokenHash)]
)
```

Conferir que `uniqueIndex` já está no import de `drizzle-orm/pg-core` no topo do arquivo; se não estiver, acrescentar ao import existente.

- [ ] **Step 2: Gerar a migration**

Run: `npm run db:generate`
Expected: novo arquivo em `lib/db/migrations/` com `ALTER TABLE "people" ADD COLUMN "share_token_hash" text;`, o mesmo para `share_token`, e `CREATE UNIQUE INDEX "people_share_token_hash_idx" ON "people" ("share_token_hash");`.

Não há backfill: as colunas nascem `NULL` para todas as linhas, e Postgres permite múltiplos `NULL` num unique index.

- [ ] **Step 3: Formatar os metadados do Drizzle Kit**

Run: `npx prettier --write lib/db/migrations/meta/`
Expected: arquivos de meta reformatados (o pre-push hook rejeita a formatação original).

- [ ] **Step 4: Aplicar a migration**

Run: `npm run db:migrate`
Expected: aplica sem erro. Isso é obrigatório antes de testar qualquer mutation — sem o index no banco, a Task 3 falha em runtime.

- [ ] **Step 5: Confirmar que o typecheck passa**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "feat(db): add share token columns to people"
```

---

### Task 3: Query do extrato compartilhado

O único ponto do código que conhece o token. Encapsula "achar a pessoa pelo hash" e "buscar os dados do dono dela", para que a rota pública não monte query própria.

**Files:**
- Modify: `lib/queries/debtors.ts`
- Create: `__tests__/integration/shared-statement.test.ts`

**Interfaces:**
- Consumes: `hashShareToken` (Task 1); colunas da Task 2.
- Produces:
  - `type SharedDebtStatement = { ownerName: string | null; personName: string; charges: OpenChargeForLinking[]; pixKey: string | null }`
  - `getSharedDebtStatement(tokenHash: string): Promise<SharedDebtStatement | null>`
  - `getPersonDebtDetails` passa a devolver `person.shareToken: string | null` (já decriptado)

`OpenChargeForLinking` já existe no arquivo e tem o shape `{ id: string; description: string; amount: number; entryDate: string }`.

- [ ] **Step 1: Escrever os testes falhando**

Criar `__tests__/integration/shared-statement.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createCharge } from './helpers/factories'
import { generateShareToken, hashShareToken } from '@/lib/utils/share-token'

neonTestingSetup()

let db: TestDb
let userId: string
let personA: string
let personB: string
let tokenA: string
let tokenB: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `shared-${Date.now()}`))
  ;({ id: personA } = await createPerson(db, userId, 'Pessoa A'))
  ;({ id: personB } = await createPerson(db, userId, 'Pessoa B'))

  await createCharge(db, userId, personA, { amount: '100.00', description: 'Jantar A' })
  await createCharge(db, userId, personB, { amount: '250.00', description: 'Uber B' })

  tokenA = generateShareToken()
  tokenB = generateShareToken()
  await db
    .update(schema.people)
    .set({ shareTokenHash: hashShareToken(tokenA) })
    .where(eq(schema.people.id, personA))
  await db
    .update(schema.people)
    .set({ shareTokenHash: hashShareToken(tokenB) })
    .where(eq(schema.people.id, personB))
})

describe('getSharedDebtStatement', () => {
  it('devolve as cobranças em aberto da pessoa dona do token, decriptadas', async () => {
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    const result = await getSharedDebtStatement(hashShareToken(tokenA))

    expect(result).not.toBeNull()
    expect(result!.personName).toBe('Pessoa A')
    expect(result!.charges).toHaveLength(1)
    expect(result!.charges[0].description).toBe('Jantar A')
    expect(result!.charges[0].amount).toBe(100)
  })

  it('não vaza as cobranças de outra pessoa do mesmo dono', async () => {
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    const result = await getSharedDebtStatement(hashShareToken(tokenA))

    const descriptions = result!.charges.map((c) => c.description)
    expect(descriptions).not.toContain('Uber B')
  })

  it('devolve null para hash inexistente', async () => {
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    expect(await getSharedDebtStatement(hashShareToken(generateShareToken()))).toBeNull()
  })

  it('devolve lista vazia — não null — quando a pessoa não tem cobrança em aberto', async () => {
    const { id: semDivida } = await createPerson(db, userId, 'Sem Dívida')
    const token = generateShareToken()
    await db
      .update(schema.people)
      .set({ shareTokenHash: hashShareToken(token) })
      .where(eq(schema.people.id, semDivida))

    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')
    const result = await getSharedDebtStatement(hashShareToken(token))

    expect(result).not.toBeNull()
    expect(result!.charges).toEqual([])
  })
})
```

O segundo teste é o que importa: a implementação errada mais provável deriva o `personId` de outro lugar que não a linha encontrada pelo hash, e com uma pessoa só os dois caminhos passariam igual.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test:integration -- shared-statement`
Expected: FAIL — `getSharedDebtStatement is not a function`.

Requer `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID` e `ENCRYPTION_MASTER_KEY` no `.env.local`.

- [ ] **Step 3: Implementar a query**

Acrescentar em `lib/queries/debtors.ts`, depois de `getOpenChargesForPeople`:

```ts
export type SharedDebtStatement = {
  ownerName: string | null
  personName: string
  charges: OpenChargeForLinking[]
  pixKey: string | null
}

/**
 * Extrato público de um devedor, resolvido a partir do hash do token.
 *
 * O `userId` usado nas queries seguintes vem SEMPRE da linha encontrada aqui —
 * nunca de parâmetro de URL. Esse é o invariante de segurança da rota `/e/`.
 */
export async function getSharedDebtStatement(
  tokenHash: string
): Promise<SharedDebtStatement | null> {
  const rows = await db
    .select({
      personId: people.id,
      userId: people.userId,
      personName: people.name,
      ownerName: users.name,
    })
    .from(people)
    .innerJoin(users, eq(people.userId, users.id))
    .where(eq(people.shareTokenHash, tokenHash))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const [charges, pixKey, dek] = await Promise.all([
    getOpenChargesForPerson(row.userId, row.personId),
    getUserPixKey(row.userId),
    getDekForUser(row.userId),
  ])

  return {
    ownerName: row.ownerName,
    personName: decryptField(row.personName, dek),
    charges,
    pixKey,
  }
}
```

Acrescentar aos imports do topo do arquivo: `users` em `@/lib/db/schema` e `getUserPixKey` de `@/lib/queries/settings`. `getDekForUser` e `decryptField` já estão importados. Não há ciclo de import: `lib/queries/settings.ts` não importa `debtors`.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test:integration -- shared-statement`
Expected: PASS — 4 testes.

- [ ] **Step 5: Expor o token decriptado na query de detalhe**

Ainda em `lib/queries/debtors.ts`: no `return` de `getPersonDebtDetails` (por volta da linha 291), acrescentar um campo ao objeto `person`:

```ts
      archived: person.archived,
      shareToken: decryptOptional(person.shareToken, dek),
```

E no tipo `PersonDebtDetails` (linha ~117), acrescentar `shareToken: string | null` ao shape de `person`.

`decryptOptional` — não `decryptField` — porque a coluna é nullable e `decryptField(null)` lança.

- [ ] **Step 6: Confirmar typecheck e suíte**

Run: `npm run typecheck && npm test`
Expected: PASS. `npm test` (unitários) não toca a query nova, mas o typecheck pega qualquer consumidor de `PersonDebtDetails` que precise se ajustar.

- [ ] **Step 7: Commit**

```bash
git add lib/queries/debtors.ts __tests__/integration/shared-statement.test.ts
git commit -m "feat(devedores): add getSharedDebtStatement query"
```

---

### Task 4: Action de gerar/rotacionar o link

**Files:**
- Modify: `lib/actions/debtors.ts`
- Create: `__tests__/integration/actions-share-link.test.ts`

**Interfaces:**
- Consumes: `generateShareToken`, `hashShareToken` (Task 1); `getSharedDebtStatement` (Task 3, usada no teste de rotação); `SITE_URL` de `@/lib/utils/site`.
- Produces: `generateShareLink(personId: string): Promise<{ url: string }>`

- [ ] **Step 1: Escrever os testes falhando**

Criar `__tests__/integration/actions-share-link.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createCharge } from './helpers/factories'
import { hashShareToken } from '@/lib/utils/share-token'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))
vi.mock('@/lib/auth/ownership', () => ({ assertOwnsPerson: vi.fn() }))

const FOREIGN_UUID = '00000000-0000-0000-0000-000000000000'

neonTestingSetup()

let db: TestDb
let userId: string
let personId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `sharelink-${Date.now()}`))
  ;({ id: personId } = await createPerson(db, userId, 'Namorada'))
  await createCharge(db, userId, personId, { amount: '80.00', description: 'Cinema' })

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
  const { assertOwnsPerson } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsPerson).mockResolvedValue(undefined)
})

afterEach(async () => {
  // mockRejectedValueOnce não consumido contamina o teste seguinte
  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
  const { assertOwnsPerson } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsPerson).mockResolvedValue(undefined)
})

describe('generateShareLink', () => {
  it('grava o hash e o token cifrado, e devolve a URL', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { url } = await generateShareLink(personId)

    const token = url.split('/e/')[1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const row = await db.query.people.findFirst({ where: eq(schema.people.id, personId) })
    expect(row!.shareTokenHash).toBe(hashShareToken(token))
    // o token não fica legível no banco
    expect(row!.shareToken).toMatch(/^enc:/)
    expect(row!.shareToken).not.toContain(token)
  })

  it('o token gravado resolve o extrato daquela pessoa', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')

    const { url } = await generateShareLink(personId)
    const token = url.split('/e/')[1]

    const statement = await getSharedDebtStatement(hashShareToken(token))
    expect(statement!.personName).toBe('Namorada')
    expect(statement!.charges.map((c) => c.description)).toContain('Cinema')
  })

  it('gerar de novo invalida o link anterior', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')

    const primeiro = (await generateShareLink(personId)).url.split('/e/')[1]
    const segundo = (await generateShareLink(personId)).url.split('/e/')[1]

    expect(segundo).not.toBe(primeiro)
    expect(await getSharedDebtStatement(hashShareToken(primeiro))).toBeNull()
    expect(await getSharedDebtStatement(hashShareToken(segundo))).not.toBeNull()
  })

  it('revalida a página da pessoa', async () => {
    const { revalidatePath } = await import('next/cache')
    const { generateShareLink } = await import('@/lib/actions/debtors')

    vi.mocked(revalidatePath).mockClear()
    await generateShareLink(personId)

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/devedores/${personId}`)
  })

  it('checa ownership com os IDs corretos', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    const { generateShareLink } = await import('@/lib/actions/debtors')

    vi.mocked(assertOwnsPerson).mockClear()
    await generateShareLink(personId)

    expect(vi.mocked(assertOwnsPerson)).toHaveBeenCalledWith(userId, personId)
  })

  it('rejeita pessoa de outro usuário', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPerson).mockRejectedValueOnce(new Error('Forbidden'))

    const { generateShareLink } = await import('@/lib/actions/debtors')
    await expect(generateShareLink(FOREIGN_UUID)).rejects.toThrow('Forbidden')
  })

  it('rejeita id que não é UUID antes de tocar no banco', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    await expect(generateShareLink('nao-e-uuid')).rejects.toThrow()
  })
})
```

`FOREIGN_UUID` precisa ser um UUID válido: um `'id-de-outro-usuario'` seria rejeitado pelo schema antes de chegar ao ownership check, deixando o `mockRejectedValueOnce` não consumido e contaminando o teste seguinte (`.claude/testing.md`).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test:integration -- actions-share-link`
Expected: FAIL — `generateShareLink is not a function`.

- [ ] **Step 3: Implementar a action**

Acrescentar ao fim de `lib/actions/debtors.ts`:

```ts
/**
 * Gera (ou rotaciona) o link público de extrato de uma pessoa.
 *
 * Não existe "revogar" separado: gravar um hash novo já invalida o anterior,
 * porque o lookup da rota `/e/` só encontra pelo hash atual.
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

  return { url: `${SITE_URL}/e/${token}` }
}
```

Acrescentar aos imports do topo: `generateShareToken` e `hashShareToken` de `@/lib/utils/share-token`, `SITE_URL` de `@/lib/utils/site`, e `uuidSchema` de `@/lib/validations/utils` se ainda não estiver lá. `requireUserId`, `assertOwnsPerson`, `db`, `people`, `and`, `eq`, `encryptField`, `getDekForUser` e `revalidatePath` já estão importados no arquivo.

Não revalidar `/panorama`: a action não altera dado financeiro (`.claude/domain.md`).

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test:integration -- actions-share-link`
Expected: PASS — 7 testes.

- [ ] **Step 5: Rodar os gates**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/debtors.ts __tests__/integration/actions-share-link.test.ts
git commit -m "feat(devedores): add generateShareLink action"
```

---

### Task 5: Rota pública `/e/[token]`

**Files:**
- Create: `app/(share)/layout.tsx`
- Create: `app/(share)/e/[token]/page.tsx`
- Create: `components/share/SharedChargeList.tsx`
- Create: `components/share/CopyPixButton.tsx`
- Modify: `app/robots.ts`

**Interfaces:**
- Consumes: `getSharedDebtStatement` (Task 3), `shareTokenSchema` (Task 1), `hashShareToken` (Task 1), `OpenChargeForLinking` de `@/lib/queries/debtors`.
- Produces: rota `/e/<token>`. Nada depende dela.

- [ ] **Step 1: Criar o layout do route group**

`app/(share)/layout.tsx`:

```tsx
/**
 * Shell da página pública de extrato. Não pode viver em `(app)` — aquele layout
 * chama `auth()` e monta Sidebar/BottomNav — nem em `(marketing)`, que força
 * `.theme-light` e traz o footer da landing.
 *
 * Sem providers: quem abre isso vem de um link no WhatsApp, uma vez, no celular.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary antialiased">
      <main className="mx-auto w-full max-w-lg px-4 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Criar a página**

`app/(share)/e/[token]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSharedDebtStatement } from '@/lib/queries/debtors'
import { shareTokenSchema } from '@/lib/validations/utils'
import { hashShareToken } from '@/lib/utils/share-token'
import { formatCurrency } from '@/lib/utils/currency'
import { SharedChargeList } from '@/components/share/SharedChargeList'
import { CopyPixButton } from '@/components/share/CopyPixButton'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function SharedStatementPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Valida o formato antes de tocar no banco: string crua de URL nunca vai
  // direto para query.
  const parsed = shareTokenSchema.safeParse(token)
  if (!parsed.success) notFound()

  const statement = await getSharedDebtStatement(hashShareToken(parsed.data))
  if (!statement) notFound()

  const total = statement.charges.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-small text-text-tertiary">Olá, {statement.personName}</p>
        <h1 className="text-h2 font-semibold">
          {statement.ownerName ? `Você deve para ${statement.ownerName}` : 'Seu extrato'}
        </h1>
      </header>

      {statement.charges.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nada em aberto"
          description="Não há cobranças pendentes no momento."
          boxed
        />
      ) : (
        <>
          <Card padding="md">
            <p className="text-caption text-text-secondary">Total em aberto</p>
            <p className="text-hero tabular-nums text-text-primary">{formatCurrency(total)}</p>
          </Card>

          {statement.pixKey && <CopyPixButton pixKey={statement.pixKey} />}

          <SharedChargeList charges={statement.charges} />
        </>
      )}
    </div>
  )
}
```

O total é sempre o total geral, nunca o do mês filtrado — mesma semântica do `OpenChargesPicker`, e a que evita a pessoa concluir que deve menos do que deve.

- [ ] **Step 3: Criar a lista com filtro de mês**

`components/share/SharedChargeList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, formatMonthShort } from '@/lib/utils/date'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

/**
 * Agrupa por `entryDate`, não por `referenceMonth` — é a mesma derivação de
 * `OpenChargesPicker`, para que o mês visto aqui seja o mesmo que o dono vê no
 * dialog de cobrança.
 */
function getUniqueMonths(charges: OpenChargeForLinking[]): string[] {
  const months = new Set(charges.map((c) => c.entryDate.slice(0, 7)))
  return [...months].sort((a, b) => b.localeCompare(a))
}

export function SharedChargeList({ charges }: { charges: OpenChargeForLinking[] }) {
  const months = getUniqueMonths(charges)
  const [activeMonth, setActiveMonth] = useState<string>('all')

  const visible =
    activeMonth === 'all' ? charges : charges.filter((c) => c.entryDate.startsWith(activeMonth))

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-label text-text-secondary">Cobranças em aberto</h2>
        {months.length > 1 && (
          <Select value={activeMonth} onValueChange={setActiveMonth}>
            <SelectTrigger className="h-8 w-auto bg-bg-input px-3 text-small">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthShort(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card padding="none">
        <ul className="divide-y divide-border">
          {visible.map((charge) => (
            <li key={charge.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-text-primary">{charge.description}</p>
                <p className="text-caption text-text-tertiary">{formatDate(charge.entryDate)}</p>
              </div>
              <span className="shrink-0 text-body tabular-nums text-text-primary">
                {formatCurrency(charge.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
```

O default é `'all'` (e não o mês mais recente, como no `OpenChargesPicker`): ali o padrão serve à seleção de itens para quitar; aqui a pessoa precisa ver tudo que deve por padrão.

- [ ] **Step 4: Criar o botão de copiar PIX**

`components/share/CopyPixButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Feedback inline em vez de `toast`: o `<Toaster>` do sonner vive em
 * `(app)/layout.tsx` e `(auth)/layout.tsx`, e o route group `(share)` não o
 * monta de propósito — um toast aqui não apareceria.
 */
export function CopyPixButton({ pixKey }: { pixKey: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(pixKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card padding="md">
      <p className="text-caption text-text-secondary">Chave Pix</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-body text-text-primary">{pixKey}</p>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 5: Manter a rota fora do crawl**

Em `app/robots.ts`, acrescentar ao array `PRIVATE_PATHS`, depois de `'/admin'`:

```ts
  '/e/',
```

O `noindex` da metadata da página é quem garante o resto — o `robots.txt` impede rastreio, não indexação por link externo.

- [ ] **Step 6: Verificar a página no navegador**

```bash
npm run dev
```

Gerar um link real: entrar em `/devedores/<id>` ainda não tem o botão (Task 6), então usar o Drizzle Studio ou um `psql` para pegar um `share_token_hash` — ou, mais simples, rodar a action pelo teste de integração e copiar a URL impressa. Abrir `http://localhost:3000/e/<token>`.

Conferir: (a) o valor total bate com a soma das cobranças; (b) o `Select` de mês só aparece com mais de um mês; (c) `/e/<token-inventado>` devolve 404; (d) pessoa sem cobrança em aberto mostra o `EmptyState`, não 404.

- [ ] **Step 7: Rodar os gates**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "app/(share)" app/robots.ts components/share
git commit -m "feat(devedores): add public debt statement page"
```

---

### Task 6: Ação de compartilhar na página da pessoa

**Files:**
- Create: `components/devedores/ShareLinkDialog.tsx`
- Modify: `components/devedores/DevedorDetailActions.tsx`
- Modify: `app/(app)/devedores/[id]/page.tsx`

**Interfaces:**
- Consumes: `generateShareLink` (Task 4); `person.shareToken` de `getPersonDebtDetails` (Task 3); `SITE_URL`.
- Produces: nada.

- [ ] **Step 1: Criar o dialog**

`components/devedores/ShareLinkDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { generateShareLink } from '@/lib/actions/debtors'

type Props = {
  personId: string
  initialUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ShareLinkContent({
  personId,
  initialUrl,
}: {
  personId: string
  initialUrl: string | null
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const result = await generateShareLink(personId)
      setUrl(result.url)
      toast.success('Novo link gerado. O anterior deixou de funcionar.')
    } catch {
      toast.error('Não foi possível gerar o link. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  return (
    <div className="space-y-3">
      <p className="text-small text-text-tertiary">
        Quem abrir o link vê as cobranças em aberto desta pessoa, sem precisar de login.
      </p>

      {url ? (
        <>
          <p className="break-all rounded-md bg-bg-subtle px-3 py-2 text-small text-text-secondary">
            {url}
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={copy} className="flex-1">
              <Copy className="h-4 w-4" />
              Copiar link
            </Button>
            <Button type="button" variant="secondary" onClick={generate} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Gerar novo
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" onClick={generate} disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar link'}
        </Button>
      )}
    </div>
  )
}

export function ShareLinkDialog({ personId, initialUrl, open, onOpenChange }: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const title = 'Compartilhar extrato'
  const content = <ShareLinkContent personId={personId} initialUrl={initialUrl} />

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{content}</div>
      </DrawerContent>
    </Drawer>
  )
}
```

Estrutura copiada do `CobrancaDialog`, que é o irmão deste no mesmo kebab: `useMediaQuery('(min-width: 1024px)')` decide entre `Dialog` e `Drawer`, com o conteúdo extraído para um subcomponente usado pelos dois. O `DrawerContent` não tem padding horizontal próprio, daí o wrapper `px-4 pb-6`.

O dialog fecha apenas por `onOpenChange` — nunca no `catch`, que esconderia a falha e sugeriria sucesso.

- [ ] **Step 2: Ligar no kebab da página**

Reescrever `components/devedores/DevedorDetailActions.tsx` inteiro (usar `Write`, não `Edit`: o hook `PostToolUse` bloqueia edits parciais que deixem imports não usados no meio do caminho):

```tsx
'use client'

import { useState } from 'react'
import { Link2, MessageCircle } from 'lucide-react'
import { RowActions } from '@/components/ui/row-actions'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { CobrancaDialog } from '@/components/devedores/CobrancaDialog'
import { ShareLinkDialog } from '@/components/devedores/ShareLinkDialog'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

interface DevedorDetailActionsProps {
  person: {
    id: string
    name: string
    email: string | null
    phone: string | null
    notes: string | null
  }
  balance: number
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
  shareUrl: string | null
}

export function DevedorDetailActions({
  person,
  balance,
  openCharges,
  pixKey,
  shareUrl,
}: DevedorDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [cobrancaOpen, setCobrancaOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      <RowActions
        onEdit={() => setEditOpen(true)}
        additionalActions={[
          {
            label: 'Cobrar via WhatsApp',
            icon: MessageCircle,
            onClick: () => setCobrancaOpen(true),
          },
          {
            label: 'Compartilhar extrato',
            icon: Link2,
            onClick: () => setShareOpen(true),
          },
        ]}
      />

      <PersonDialog
        mode="edit"
        person={person}
        balance={balance}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <CobrancaDialog
        person={person}
        openCharges={openCharges}
        pixKey={pixKey}
        open={cobrancaOpen}
        onOpenChange={setCobrancaOpen}
        onEditPhone={() => {
          setCobrancaOpen(false)
          setEditOpen(true)
        }}
      />

      <ShareLinkDialog
        personId={person.id}
        initialUrl={shareUrl}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  )
}
```

- [ ] **Step 3: Passar a URL a partir do server component**

Em `app/(app)/devedores/[id]/page.tsx`, depois de `const { person, summary, balanceEvolution, entries } = data`:

```tsx
  const shareUrl = person.shareToken ? `${SITE_URL}/e/${person.shareToken}` : null
```

E na chamada de `<DevedorDetailActions>`, acrescentar a prop:

```tsx
          <DevedorDetailActions
            person={person}
            balance={summary.balance}
            openCharges={openCharges}
            pixKey={pixKey}
            shareUrl={shareUrl}
          />
```

Acrescentar `import { SITE_URL } from '@/lib/utils/site'` ao topo do arquivo.

- [ ] **Step 4: Verificar o fluxo completo no navegador**

```bash
npm run dev
```

Em `/devedores/<id>`: abrir o kebab → "Compartilhar extrato" → "Gerar link" → copiar → abrir a URL em aba anônima e conferir que o extrato aparece. Voltar, "Gerar novo", e conferir que a URL antiga passa a dar 404 e a nova funciona. Recarregar a página da pessoa e confirmar que o dialog já abre com a URL atual (é o `shareToken` decriptado vindo do servidor).

- [ ] **Step 5: Rodar o ds-reviewer nos componentes novos**

Rodar o agente `ds-reviewer` uma única vez, passando `components/share/SharedChargeList.tsx`, `components/share/CopyPixButton.tsx` e `components/devedores/ShareLinkDialog.tsx`. Corrigir o que ele apontar.

- [ ] **Step 6: Rodar os gates**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Rodar a suíte de integração inteira**

Run: `npm run test:integration`
Expected: PASS. A mudança de shape em `PersonDebtDetails` (Task 3) pode afetar testes existentes de `debtors`.

- [ ] **Step 8: Commit**

```bash
git add components/devedores "app/(app)/devedores/[id]/page.tsx"
git commit -m "feat(devedores): add share statement action to person page"
```

---

## Verificação final

- [ ] `npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:integration` — tudo verde.
- [ ] `curl -sI http://localhost:3000/e/<token-invalido>` devolve 404.
- [ ] O HTML de `/e/<token>` válido contém `<meta name="robots" content="noindex, nofollow">`.
- [ ] `/robots.txt` (com `VERCEL_ENV=production` no build) lista `Disallow: /e/`.
- [ ] Nenhuma linha de `people` tem `share_token` legível: `SELECT share_token FROM people WHERE share_token IS NOT NULL` devolve apenas valores começando com `enc:`.
