# Column-Level Encryption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt todos os campos financeiros e de PII antes de armazenar no banco, usando AES-256-GCM com DEK por usuário cifrado por MEK em variável de ambiente.

**Architecture:** Cada usuário tem um Data Encryption Key (DEK) gerado pelo servidor, armazenado cifrado em `userSettings.encryptedDek`. Uma Master Encryption Key (MEK) em variável de ambiente decifra o DEK; o DEK decifra os campos. Criptografia acontece nas bordas: ao inserir (actions) e ao ler (queries). Campos usados em `WHERE`/`GROUP BY` ficam em plaintext. Queries que usam `SUM()` SQL em colunas criptografadas são refatoradas para agregação em JS.

**Tech Stack:** Node.js `crypto` (AES-256-GCM), React `cache()` para deduplicate DEK lookups por request, Drizzle ORM, Neon PostgreSQL, Next.js 14 Server Actions.

## Global Constraints

- Algoritmo: AES-256-GCM. IV: 12 bytes aleatórios por campo. AuthTag: 16 bytes.
- Formato em disco: `enc:<base64(iv + authTag + ciphertext)>`
- `decryptField` aceita strings sem prefixo `enc:` e as retorna como-estão (compatibilidade durante migração)
- `null`/`undefined` em campos opcionais: retornado sem modificação
- MEK: hex de 32 bytes (`openssl rand -hex 32`), variável `ENCRYPTION_MASTER_KEY`
- DEK: provisionado atomicamente com `COALESCE` para evitar race conditions
- `getDekForUser`: usar `cache()` do React para deduplicar lookups dentro do mesmo request
- Campos em plaintext (nunca criptografar): `userId`, `referenceMonth`, `date`, campos enum/boolean, `color`, `bgColor`, `closingDay`, `dueDay`, `sortOrder`, tabelas NextAuth
- Testes unitários rodam com `ENCRYPTION_MASTER_KEY` definido no ambiente de teste
- Script de migração: usa `config({ path: '.env.local' })` do dotenv, idempotente via prefixo `enc:`

---

### Task 1: Módulo de criptografia (`lib/crypto/`)

**Files:**
- Create: `lib/crypto/keys.ts`
- Create: `lib/crypto/fields.ts`
- Create: `__tests__/unit/crypto/keys.test.ts`
- Create: `__tests__/unit/crypto/fields.test.ts`
- Modify: `.env.local` (adicionar `ENCRYPTION_MASTER_KEY`)

**Interfaces:**
- Produces:
  - `generateDek(): Buffer`
  - `encryptDek(dek: Buffer): string`
  - `decryptDek(encrypted: string): Buffer`
  - `getDekForUser(userId: string): Promise<Buffer>` — usa `cache()`, lazy-provision DEK
  - `encryptField(value: string, dek: Buffer): string` — retorna `enc:<base64>`
  - `decryptField(value: string, dek: Buffer): string` — retorna plaintext; passthrough se sem prefixo `enc:`
  - `encryptOptional(value: string | null | undefined, dek: Buffer): string | null`
  - `decryptOptional(value: string | null | undefined, dek: Buffer): string | null`

- [ ] **Step 1: Gerar MEK e adicionar ao `.env.local`**

```bash
openssl rand -hex 32
```

Copiar output e adicionar ao `.env.local`:
```
ENCRYPTION_MASTER_KEY=<output do comando acima>
```

- [ ] **Step 2: Escrever testes para `fields.ts`**

Criar `__tests__/unit/crypto/fields.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

// Setar env antes de importar o módulo
beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('hex')
})

describe('encryptField / decryptField', () => {
  it('roundtrip: decrypt(encrypt(value)) === value', async () => {
    const { encryptField, decryptField } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    const value = 'R$ 1.234,56'
    const ciphertext = encryptField(value, dek)
    expect(ciphertext).toMatch(/^enc:/)
    expect(decryptField(ciphertext, dek)).toBe(value)
  })

  it('ciphertexts do mesmo valor são diferentes (IV aleatório)', async () => {
    const { encryptField } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    const c1 = encryptField('1234.56', dek)
    const c2 = encryptField('1234.56', dek)
    expect(c1).not.toBe(c2)
  })

  it('decryptField retorna plaintext como-está se sem prefixo enc: (compatibilidade)', async () => {
    const { decryptField } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    expect(decryptField('1234.56', dek)).toBe('1234.56')
  })

  it('decryptOptional retorna null para null', async () => {
    const { decryptOptional } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    expect(decryptOptional(null, dek)).toBeNull()
  })

  it('encryptOptional retorna null para null', async () => {
    const { encryptOptional } = await import('@/lib/crypto/fields')
    const dek = randomBytes(32)
    expect(encryptOptional(null, dek)).toBeNull()
  })

  it('throws ao decifrar com DEK errado', async () => {
    const { encryptField, decryptField } = await import('@/lib/crypto/fields')
    const dek1 = randomBytes(32)
    const dek2 = randomBytes(32)
    const ciphertext = encryptField('valor', dek1)
    expect(() => decryptField(ciphertext, dek2)).toThrow()
  })
})
```

- [ ] **Step 3: Rodar para confirmar falha**

```bash
npm test -- __tests__/unit/crypto/fields.test.ts
```
Expected: FAIL com "Cannot find module '@/lib/crypto/fields'"

- [ ] **Step 4: Implementar `lib/crypto/fields.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const PREFIX = 'enc:'

export function encryptField(plaintext: string, dek: Buffer): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, dek, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptField(value: string, dek: Buffer): string {
  if (!value.startsWith(PREFIX)) return value // compatibilidade: plaintext antigo
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64')
  const iv = raw.subarray(0, IV_LEN)
  const authTag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGORITHM, dek, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function encryptOptional(
  value: string | null | undefined,
  dek: Buffer
): string | null {
  if (value == null) return null
  return encryptField(value, dek)
}

export function decryptOptional(
  value: string | null | undefined,
  dek: Buffer
): string | null {
  if (value == null) return null
  return decryptField(value, dek)
}
```

- [ ] **Step 5: Rodar e confirmar aprovação**

```bash
npm test -- __tests__/unit/crypto/fields.test.ts
```
Expected: 6 testes PASS

- [ ] **Step 6: Escrever testes para `keys.ts`**

Criar `__tests__/unit/crypto/keys.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('hex')
})

describe('generateDek / encryptDek / decryptDek', () => {
  it('gera DEK de 32 bytes', async () => {
    const { generateDek } = await import('@/lib/crypto/keys')
    expect(generateDek()).toHaveLength(32)
  })

  it('roundtrip: decryptDek(encryptDek(dek)) === dek', async () => {
    const { generateDek, encryptDek, decryptDek } = await import('@/lib/crypto/keys')
    const dek = generateDek()
    const encrypted = encryptDek(dek)
    expect(encrypted).toMatch(/^enc:/)
    expect(decryptDek(encrypted)).toEqual(dek)
  })

  it('throws se ENCRYPTION_MASTER_KEY não estiver definida', async () => {
    const { generateDek, encryptDek } = await import('@/lib/crypto/keys')
    const original = process.env.ENCRYPTION_MASTER_KEY
    delete process.env.ENCRYPTION_MASTER_KEY
    expect(() => encryptDek(generateDek())).toThrow('ENCRYPTION_MASTER_KEY')
    process.env.ENCRYPTION_MASTER_KEY = original
  })
})
```

- [ ] **Step 7: Rodar para confirmar falha**

```bash
npm test -- __tests__/unit/crypto/keys.test.ts
```
Expected: FAIL com "Cannot find module '@/lib/crypto/keys'"

- [ ] **Step 8: Implementar `lib/crypto/keys.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { cache } from 'react'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'

const ALGORITHM = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 12
const TAG_LEN = 16
const PREFIX = 'enc:'

function getMek(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex) throw new Error('ENCRYPTION_MASTER_KEY não definida')
  return Buffer.from(hex, 'hex')
}

export function generateDek(): Buffer {
  return randomBytes(KEY_LEN)
}

export function encryptDek(dek: Buffer): string {
  const mek = getMek()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, mek, iv)
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()])
  const authTag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptDek(encrypted: string): Buffer {
  const mek = getMek()
  const raw = Buffer.from(encrypted.slice(PREFIX.length), 'base64')
  const iv = raw.subarray(0, IV_LEN)
  const authTag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGORITHM, mek, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// cache() deduplica chamadas dentro do mesmo request (RSC e Server Actions)
export const getDekForUser = cache(async (userId: string): Promise<Buffer> => {
  const newDek = generateDek()
  const newEncryptedDek = encryptDek(newDek)

  // Atomic upsert: COALESCE garante que nunca sobrescreve DEK existente
  const [row] = await db
    .insert(userSettings)
    .values({ userId, encryptedDek: newEncryptedDek })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        encryptedDek: sql`COALESCE(user_settings.encrypted_dek, EXCLUDED.encrypted_dek)`,
      },
    })
    .returning({ encryptedDek: userSettings.encryptedDek })

  if (!row?.encryptedDek) throw new Error(`DEK não encontrado para userId=${userId}`)
  return decryptDek(row.encryptedDek)
})
```

- [ ] **Step 9: Rodar e confirmar aprovação**

```bash
npm test -- __tests__/unit/crypto/keys.test.ts
```
Expected: 3 testes PASS

- [ ] **Step 10: Rodar todos os testes unitários para confirmar zero regressões**

```bash
npm test
```
Expected: todos os testes existentes PASS

- [ ] **Step 11: Commit**

```bash
git add lib/crypto/ __tests__/unit/crypto/ .env.local
git commit -m "feat(crypto): add AES-256-GCM module with per-user DEK"
```

---

### Task 2: Mudanças no schema e migration

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `__tests__/integration/env-setup.ts`
- Creates: `lib/db/migrations/NNNN_*.sql` (gerado pelo Drizzle)

**Interfaces:**
- Consumes: nada de Task 1 (schema é puro Drizzle)
- Produces: coluna `userSettings.encryptedDek: text | null`; colunas de amount e name como `text`

**Nota:** Mudar `decimal` → `text` e `varchar` → `text` no schema não quebra TypeScript — Drizzle já tipava ambos como `string`. A diferença é que o banco aceita qualquer string (base64 da cifra) em vez de impor formato numérico.

- [ ] **Step 1: Adicionar `encryptedDek` a `userSettings` e mudar tipos das colunas cifradas em `lib/db/schema.ts`**

Nas importações, remover `decimal` e `varchar` das colunas que vão mudar (manter para colunas que ficam), adicionar se necessário. Mudanças coluna por coluna:

```ts
// userSettings — adicionar campo
encryptedDek: text('encrypted_dek'),

// categoryGroups
name: text('name').notNull(),  // era varchar('name', { length: 100 })

// categories
name: text('name').notNull(),          // era varchar
defaultBudget: text('default_budget'), // era decimal

// monthlyBudgetOverrides
amount: text('amount').notNull(), // era decimal

// paymentAccounts
name: text('name').notNull(), // era varchar

// fixedExpenses
name: text('name').notNull(),   // era varchar
amount: text('amount').notNull(), // era decimal

// installmentGroups
name: text('name').notNull(),        // era varchar
totalAmount: text('total_amount').notNull(), // era decimal

// transactions
name: text('name').notNull(),   // era varchar
amount: text('amount').notNull(), // era decimal

// incomes
source: text('source').notNull(), // era varchar
amount: text('amount').notNull(), // era decimal
investmentReturnCapital: text('investment_return_capital'), // era decimal nullable

// goals
name: text('name').notNull(),         // era varchar
targetAmount: text('target_amount').notNull(), // era decimal

// investmentTypes
name: text('name').notNull(), // era varchar

// investments — já são nullable, apenas mudar tipo
amount: text('amount'),      // era decimal nullable
yieldAmount: text('yield_amount'), // era decimal nullable
// notes: já é text — sem mudança de tipo, mas será cifrado no valor

// investmentWithdrawals
amount: text('amount').notNull(), // era decimal
taxAmount: text('tax_amount'),    // era decimal nullable
// notes: já é text

// goalContributions
amount: text('amount').notNull(), // era decimal

// people
name: text('name').notNull(),  // era varchar
email: text('email'),          // era varchar nullable
phone: text('phone'),          // era varchar nullable
// notes: já é text

// debtorEntries
description: text('description').notNull(), // era varchar
amount: text('amount').notNull(),           // era decimal
// notes: já é text

// userSettings
pixKey: text('pix_key'), // era varchar nullable
```

- [ ] **Step 2: Gerar migration**

```bash
npm run db:generate
```

Expected: novo arquivo `lib/db/migrations/NNNN_*.sql` com ALTER TABLE statements

- [ ] **Step 3: Formatar migration gerada (obrigatório para pre-push hook)**

```bash
npx prettier --write lib/db/migrations/meta/
```

- [ ] **Step 4: Adicionar `ENCRYPTION_MASTER_KEY` ao env-setup de integração**

Em `__tests__/integration/env-setup.ts`, adicionar `'ENCRYPTION_MASTER_KEY'` à lista de vars validadas:

```ts
const REQUIRED_NEON_VARS = ['NEON_API_KEY', 'NEON_PROJECT_ID', 'NEON_PARENT_BRANCH_ID', 'ENCRYPTION_MASTER_KEY'] as const
```

- [ ] **Step 5: Aplicar migration no banco de dev**

```bash
npm run db:migrate
```

Expected: migration aplicada com sucesso. Verificar no Drizzle Studio que a coluna `encrypted_dek` aparece em `user_settings` e as colunas de amount/name estão como `text`.

```bash
npm run db:studio
```

- [ ] **Step 6: Rodar typecheck para confirmar zero erros de tipo**

```bash
npm run typecheck
```

Expected: 0 erros (decimal e varchar já eram `string` no TypeScript)

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/ __tests__/integration/env-setup.ts
git commit -m "feat(schema): change encrypted columns to text, add encryptedDek"
```

---

### Task 3: Criptografar transactions, fixedExpenses, installmentGroups

**Files:**
- Modify: `lib/actions/transactions.ts`
- Modify: `lib/queries/transactions.ts`
- Modify: `lib/queries/parcelas.ts`

**Interfaces:**
- Consumes: `getDekForUser`, `encryptField`, `decryptField`, `encryptOptional`, `decryptOptional` de `@/lib/crypto/`

- [ ] **Step 1: Adicionar encrypt/decrypt em `lib/actions/transactions.ts`**

No topo, adicionar imports:
```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
```

Em cada função de mutação, obter o DEK antes do INSERT/UPDATE e cifrar os campos `name` e `amount`. Exemplo para `createTransaction`:

```ts
export async function createTransaction(data: CreateTransactionInput) {
  const userId = await requireUserId()
  // ... validação e ownership checks existentes ...
  const dek = await getDekForUser(userId)

  await db.insert(transactions).values({
    userId,
    accountId: data.accountId,
    categoryId: data.categoryId,
    referenceMonth: data.referenceMonth,
    date: data.date,
    installmentNumber: data.installmentNumber ?? null,
    totalInstallments: data.totalInstallments ?? null,
    faturaAccountId: data.faturaAccountId ?? null,
    faturaCycleMonth: data.faturaCycleMonth ?? null,
    installmentGroupId: data.installmentGroupId ?? null,
    name: encryptField(data.name, dek),       // ← cifrar
    amount: encryptField(data.amount, dek),   // ← cifrar
  })
  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}
```

Aplicar o mesmo padrão (`getDekForUser` + `encryptField` nos campos `name`/`amount`) em:
- `updateTransaction`
- `createFixedExpense`
- `updateFixedExpense`
- `createInstallmentPurchase` (cifra `name` e `totalAmount` em `installmentGroups`, e `name`/`amount` nas transactions geradas)
- `updateInstallment`
- `copyFixedExpensesFromPrevMonth` — **não precisa cifrar**: copia rows já cifradas do banco; o ciphertext existente é reutilizável porque o DEK do usuário não muda

- [ ] **Step 2: Adicionar decrypt em `lib/queries/transactions.ts`**

Importar:
```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
```

Em cada função que retorna rows de `transactions` ou `fixedExpenses`, descriptografar antes de retornar:

```ts
export async function getTransactions(userId: string, referenceMonth: string) {
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.referenceMonth, referenceMonth)),
    with: { category: true, account: true, installmentGroup: true },
    orderBy: [desc(transactions.date)],
  })
  const dek = await getDekForUser(userId)
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    // installmentGroup.name e totalAmount também cifrados:
    installmentGroup: row.installmentGroup
      ? {
          ...row.installmentGroup,
          name: decryptField(row.installmentGroup.name, dek),
          totalAmount: decryptField(row.installmentGroup.totalAmount, dek),
        }
      : null,
  }))
}
```

Aplicar o mesmo padrão em todas as funções query que retornam rows dessas tabelas.

- [ ] **Step 3: Atualizar `lib/queries/parcelas.ts`**

Importar e descriptografar campos `name`/`totalAmount` de `installmentGroups` e `name`/`amount` das transactions retornadas.

- [ ] **Step 4: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```
Expected: 0 erros

- [ ] **Step 5: Verificar e atualizar `lib/actions/fatura.ts` e `lib/actions/historico.ts`**

Esses arquivos podem escrever diretamente em `transactions`, `fixedExpenses` ou `incomes`. Checar:

```bash
grep -n "db.insert\|db.update" lib/actions/fatura.ts lib/actions/historico.ts
```

Para cada insert/update nas tabelas com campos cifrados, adicionar `getDekForUser` + `encryptField` seguindo o padrão de Task 3, Step 1.

**Nota sobre a rota cron (`app/api/cron/rollover-fixed-expenses/route.ts`):** NÃO precisa de alterações. Ela copia rows de `fixedExpenses` de um mês para outro — os valores `name` e `amount` já são ciphertext cifrado com o DEK do usuário, e o mesmo DEK decifra o novo mês. Copiar ciphertext entre meses é seguro.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/transactions.ts lib/queries/transactions.ts lib/queries/parcelas.ts lib/actions/fatura.ts lib/actions/historico.ts
git commit -m "feat(crypto): encrypt transactions, fixedExpenses, installmentGroups"
```

---

### Task 4: Criptografar incomes

**Files:**
- Modify: `lib/actions/incomes.ts`

**Interfaces:**
- Consumes: `getDekForUser`, `encryptField`, `encryptOptional`

**Nota:** `incomes` são lidos em `dashboard.ts`, `panorama.ts`, `historico.ts` — descriptografados nas Tasks 10 e 11.

- [ ] **Step 1: Adicionar encrypt em `lib/actions/incomes.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
```

Em `createIncome`:
```ts
export async function createIncome(data: CreateIncomeInput) {
  const userId = await requireUserId()
  const parsed = createIncomeActionSchema.parse(data)
  const dek = await getDekForUser(userId)

  await db.insert(incomes).values({
    userId,
    referenceMonth: parsed.referenceMonth,
    source: encryptField(parsed.source, dek),
    amount: encryptField(parsed.amount, dek),
    investmentReturnCapital: encryptOptional(parsed.investmentReturnCapital ?? null, dek),
  })
  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}
```

Aplicar o mesmo em `updateIncome`.

- [ ] **Step 2: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/incomes.ts
git commit -m "feat(crypto): encrypt incomes on insert/update"
```

---

### Task 5: Criptografar investments, withdrawals, goalContributions + refatorar SQL SUM

**Files:**
- Modify: `lib/actions/investments.ts`
- Modify: `lib/queries/investments.ts`

**Problema:** `investments.ts` usa `sum()` SQL em `investments.amount`, `investments.yieldAmount`, e `investmentWithdrawals.amount + taxAmount`. Após criptografar essas colunas como text, `SUM(text)` falha no PostgreSQL. Solução: buscar rows individuais, descriptografar, agregar em JS.

**Interfaces:**
- Consumes: `getDekForUser`, `encryptField`, `encryptOptional`, `decryptField`, `decryptOptional`
- Produces: mesmos retornos de tipo das funções existentes

- [ ] **Step 1: Adicionar encrypt em `lib/actions/investments.ts`**

Importar:
```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'
```

Em `createInvestmentEntry` (ou equivalente), cifrar `amount`, `yieldAmount`, `notes`:
```ts
const dek = await getDekForUser(userId)
await db.insert(investments).values({
  userId,
  investmentTypeId: data.investmentTypeId,
  referenceMonth: data.referenceMonth,
  excludeFromCashFlow: data.excludeFromCashFlow ?? false,
  amount: encryptOptional(data.amount ?? null, dek),
  yieldAmount: encryptOptional(data.yieldAmount ?? null, dek),
  notes: encryptOptional(data.notes ?? null, dek),
})
```

Em funções que calculam `balance` verificando se `> 0` (como `createWithdrawal`), a lógica atual usa `sum()` SQL. Refatorar para JS:

```ts
// Antes (SQL SUM — não funciona com text cifrado):
// const [{ totalAmount }] = await db.select({ totalAmount: sum(investments.amount) })...

// Depois (JS aggregation):
const investmentRows = await db.select({
  amount: investments.amount,
  yieldAmount: investments.yieldAmount,
}).from(investments).where(
  and(eq(investments.userId, userId), eq(investments.investmentTypeId, data.investmentTypeId))
)
const totalAmount = investmentRows.reduce((acc, r) => {
  return acc + toAmount(decryptOptional(r.amount, dek))
}, 0)

const withdrawalRows = await db.select({
  amount: investmentWithdrawals.amount,
  taxAmount: investmentWithdrawals.taxAmount,
}).from(investmentWithdrawals).where(
  and(eq(investmentWithdrawals.userId, userId), eq(investmentWithdrawals.investmentTypeId, data.investmentTypeId))
)
const totalWithdrawn = withdrawalRows.reduce((acc, r) => {
  return acc + toAmount(decryptOptional(r.amount, dek)) + toAmount(decryptOptional(r.taxAmount, dek))
}, 0)

const balance = totalAmount - totalWithdrawn
if (Math.round(balance * 100) <= 0) throw new Error('Saldo insuficiente')
```

Aplicar o mesmo padrão em `updateInvestmentEntry` e `createWithdrawal`.

Para `withdrawals`: cifrar `amount`, `taxAmount`, `notes`:
```ts
const dek = await getDekForUser(userId)
await db.insert(investmentWithdrawals).values({
  userId,
  investmentTypeId: data.investmentTypeId,
  date: data.date,
  destination: data.destination,
  incomeId: incomeId ?? null,
  amount: encryptField(String(data.amount), dek),
  taxAmount: encryptOptional(data.taxAmount ? String(data.taxAmount) : null, dek),
  notes: encryptOptional(data.notes ?? null, dek),
})
```

Para `goalContributions`: cifrar `amount`:
```ts
amount: encryptField(String(data.amount), dek),
```

- [ ] **Step 2: Refatorar `lib/queries/investments.ts` — substituir SQL SUM por JS aggregation**

Identificar funções que usam `sum()` e refatorá-las para buscar rows individuais + descriptografar + somar em JS. Estrutura padrão:

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'

// Exemplo: getInvestmentTypeSummaries
export async function getInvestmentTypeSummaries(userId: string) {
  const dek = await getDekForUser(userId)
  
  const types = await db.query.investmentTypes.findMany({
    where: and(eq(investmentTypes.userId, userId), eq(investmentTypes.archived, false)),
    with: {
      investments: true,
      withdrawals: true,
    },
  })
  
  return types.map((type) => {
    const totalAmount = type.investments.reduce((acc, inv) => {
      return acc + toAmount(decryptOptional(inv.amount, dek))
    }, 0)
    const totalYield = type.investments.reduce((acc, inv) => {
      return acc + toAmount(decryptOptional(inv.yieldAmount, dek))
    }, 0)
    const totalWithdrawn = type.withdrawals.reduce((acc, w) => {
      return acc + toAmount(decryptField(w.amount, dek)) + toAmount(decryptOptional(w.taxAmount, dek))
    }, 0)
    return {
      ...type,
      name: decryptField(type.name, dek),
      totalAmount,
      totalYield,
      totalWithdrawn,
      balance: totalAmount - totalWithdrawn,
    }
  })
}
```

- [ ] **Step 3: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/investments.ts lib/queries/investments.ts
git commit -m "feat(crypto): encrypt investments, withdrawals, goalContributions; refactor SQL SUM to JS"
```

---

### Task 6: Criptografar categories, categoryGroups, monthlyBudgetOverrides

**Files:**
- Modify: `lib/actions/categories.ts`
- Modify: `lib/queries/categories.ts`
- Modify: `lib/actions/reset-account.ts`

**Nota importante:** `reset-account.ts` re-seed categorias com dados hardcoded — esses inserts também precisam cifrar `name` e `defaultBudget`. Além disso, `reset-account.ts` deleta `userSettings`, o que apaga o `encryptedDek`. O próximo `getDekForUser` provisionará um DEK novo automaticamente — não é problema porque os dados foram resetados.

- [ ] **Step 1: Adicionar encrypt em `lib/actions/categories.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
```

Funções a atualizar: `createCategoryGroup`, `updateCategoryGroup`, `createCategory`, `updateCategory`, `upsertMonthlyBudgetOverride`.

Exemplo para `createCategoryGroup`:
```ts
export async function createCategoryGroup(data: { name: string }) {
  const userId = await requireUserId()
  const dek = await getDekForUser(userId)
  await db.insert(categoryGroups).values({
    userId,
    name: encryptField(data.name, dek),
  })
  revalidatePath('/categorias')
}
```

Para `upsertMonthlyBudgetOverride`, cifrar `amount`:
```ts
const dek = await getDekForUser(userId)
await db.insert(monthlyBudgetOverrides).values({
  userId,
  categoryId: data.categoryId,
  referenceMonth: data.referenceMonth,
  amount: encryptField(data.amount, dek),
}).onConflictDoUpdate({
  target: [monthlyBudgetOverrides.userId, monthlyBudgetOverrides.categoryId, monthlyBudgetOverrides.referenceMonth],
  set: { amount: encryptField(data.amount, dek) },
})
```

- [ ] **Step 2: Adicionar encrypt no `reset-account.ts` para o re-seed**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
```

Dentro do `db.transaction`, após deletar userSettings, obter (ou provisionar) DEK antes dos inserts de categorias:
```ts
// DEK novo é provisionado automaticamente por getDekForUser
// (userSettings foi deletado acima — getDekForUser vai criar novo registro)
const dek = await getDekForUser(userId)

for (const group of DEFAULT_GROUPS) {
  const [inserted] = await tx
    .insert(categoryGroups)
    .values({ userId, name: encryptField(group.name, dek), sortOrder: group.sortOrder })
    .returning({ id: categoryGroups.id })

  if (!inserted) continue

  await tx.insert(categories).values(
    group.categories.map((cat) => ({
      userId,
      groupId: inserted.id,
      name: encryptField(cat.name, dek),
      defaultBudget: encryptOptional(cat.defaultBudget, dek),
      color: cat.color,
      bgColor: cat.bgColor,
    }))
  )
}
```

**Nota:** `getDekForUser` usa `db` (não `tx`) porque o `onConflictDoUpdate` do upsert não é compatível com a transaction que está deletando userSettings. Mover o `getDekForUser` para ANTES do `db.transaction`:

```ts
export async function resetAccount() {
  const userId = await requireUserId()
  // Obter DEK ANTES da transaction — transaction vai deletar userSettings
  // getDekForUser vai provisionar novo DEK pós-delete
  // (Na verdade: chamar depois do delete. Ver nota abaixo)
```

**Atenção:** como `userSettings` é deletado dentro da transaction, e `getDekForUser` faz upsert em `userSettings`, precisamos chamar `getDekForUser` DEPOIS que a transaction fizer o delete mas usando a transaction connection (ou após a transaction). A solução mais simples: chamar `getDekForUser(userId)` logo após o bloco `db.transaction` (fora dele), e os inserts de seed também ficam fora da transaction, em sequência:

```ts
export async function resetAccount() {
  const userId = await requireUserId()

  await db.transaction(async (tx) => {
    // ... todos os deletes ...
    // Seed de categorias com plaintext temporário — criptografado em seguida
    for (const group of DEFAULT_GROUPS) {
      // ... inserts com name plaintext ...
    }
  })

  // Re-criptografar os seeds após provisionar DEK novo
  // OU: fazer seed fora da transaction com DEK novo
```

**Solução mais simples:** mover o seed para fora da transaction:

```ts
export async function resetAccount() {
  const userId = await requireUserId()

  // 1. Deletar tudo numa transaction
  await db.transaction(async (tx) => {
    await tx.delete(debtorEntries).where(eq(debtorEntries.userId, userId))
    // ... outros deletes ...
    await tx.delete(userSettings).where(eq(userSettings.userId, userId))
    await tx.delete(categories).where(eq(categories.userId, userId))
    await tx.delete(categoryGroups).where(eq(categoryGroups.userId, userId))
  })

  // 2. Provisionar novo DEK (userSettings foi deletado, getDekForUser cria novo registro)
  const dek = await getDekForUser(userId)

  // 3. Seed de categorias com encryption
  for (const group of DEFAULT_GROUPS) {
    const [inserted] = await db
      .insert(categoryGroups)
      .values({ userId, name: encryptField(group.name, dek), sortOrder: group.sortOrder })
      .returning({ id: categoryGroups.id })
    if (!inserted) continue
    await db.insert(categories).values(
      group.categories.map((cat) => ({
        userId,
        groupId: inserted.id,
        name: encryptField(cat.name, dek),
        defaultBudget: encryptOptional(cat.defaultBudget, dek),
        color: cat.color,
        bgColor: cat.bgColor,
      }))
    )
  }

  revalidatePath('/', 'layout')
}
```

- [ ] **Step 3: Adicionar decrypt em `lib/queries/categories.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
```

Em todas as funções que retornam `categoryGroups`, `categories` ou `monthlyBudgetOverrides`, descriptografar `name`, `defaultBudget`, `amount` antes de retornar.

- [ ] **Step 4: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/categories.ts lib/queries/categories.ts lib/actions/reset-account.ts
git commit -m "feat(crypto): encrypt categoryGroups, categories, budgetOverrides"
```

---

### Task 7: Criptografar goals e investmentTypes (e paymentAccounts)

**Files:**
- Modify: `lib/actions/goals.ts`
- Modify: `lib/queries/goals.ts`
- Modify: `lib/actions/investments.ts` (para `investmentTypes` — já aberto na Task 5, adicionar aqui se necessário)

**Nota:** `paymentAccounts.name` é cifrado; suas actions provavelmente estão em um arquivo próprio ou em `categories.ts`/`settings.ts`. Verificar e adicionar encryption onde os inserts de `paymentAccounts` ocorrem.

- [ ] **Step 1: Adicionar encrypt em `lib/actions/goals.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
```

Em `createGoal`, `updateGoal`:
```ts
const dek = await getDekForUser(userId)
await db.insert(goals).values({
  userId,
  name: encryptField(data.name, dek),
  targetAmount: encryptField(String(data.targetAmount), dek),
  targetDate: data.targetDate ?? null,
  investmentTypeId: data.investmentTypeId ?? null,
})
```

Em `createInvestmentType`, `updateInvestmentType` (se estiverem em `investments.ts`):
```ts
name: encryptField(data.name, dek),
```

- [ ] **Step 2: Refatorar `lib/queries/goals.ts` — SQL SUM → JS aggregation + decrypt**

`goals.ts` usa `sum()` em `investments.amount`, `investments.yieldAmount`, e `investmentWithdrawals.amount`. Refatorar:

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'

export async function getGoalsWithProgress(userId: string) {
  const dek = await getDekForUser(userId)

  const goalsData = await db.query.goals.findMany({
    where: eq(goals.userId, userId),
    with: {
      investmentType: {
        with: {
          investments: true,
          withdrawals: true,
        },
      },
      contributions: true,
    },
  })

  return goalsData.map((goal) => {
    const totalAmount = goal.investmentType?.investments.reduce((acc, inv) => {
      return acc + toAmount(decryptOptional(inv.amount, dek))
    }, 0) ?? 0

    const totalYield = goal.investmentType?.investments.reduce((acc, inv) => {
      return acc + toAmount(decryptOptional(inv.yieldAmount, dek))
    }, 0) ?? 0

    const totalWithdrawn = goal.investmentType?.withdrawals.reduce((acc, w) => {
      return acc + toAmount(decryptField(w.amount, dek)) + toAmount(decryptOptional(w.taxAmount, dek))
    }, 0) ?? 0

    return {
      ...goal,
      name: decryptField(goal.name, dek),
      targetAmount: decryptField(goal.targetAmount, dek),
      investmentType: goal.investmentType
        ? { ...goal.investmentType, name: decryptField(goal.investmentType.name, dek) }
        : null,
      currentBalance: totalAmount + totalYield - totalWithdrawn,
    }
  })
}
```

- [ ] **Step 3: Verificar e atualizar inserts de `paymentAccounts`**

Buscar onde `paymentAccounts` é inserido/atualizado:
```bash
grep -rn "insert(paymentAccounts)\|update(paymentAccounts)" lib/actions/
```

Adicionar `getDekForUser` + `encryptField` no campo `name` nesses locais.

- [ ] **Step 4: Adicionar decrypt onde paymentAccounts.name é retornado em queries**

As queries que retornam `paymentAccounts` com `with: { account: true }` retornarão `account.name` criptografado. Descriptografar nos pontos de retorno.

- [ ] **Step 5: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/actions/goals.ts lib/queries/goals.ts lib/actions/investments.ts
git commit -m "feat(crypto): encrypt goals, investmentTypes, paymentAccounts"
```

---

### Task 8: Criptografar people e debtorEntries

**Files:**
- Modify: `lib/actions/debtors.ts`
- Modify: `lib/queries/debtors.ts`

- [ ] **Step 1: Adicionar encrypt em `lib/actions/debtors.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField, encryptOptional } from '@/lib/crypto/fields'
```

Em `createPerson`, `updatePerson`:
```ts
const dek = await getDekForUser(userId)
await db.insert(people).values({
  userId,
  name: encryptField(data.name, dek),
  email: encryptOptional(data.email ?? null, dek),
  phone: encryptOptional(data.phone ?? null, dek),
  notes: encryptOptional(data.notes ?? null, dek),
})
```

Em `createDebtEntry`, `updateDebtEntry`:
```ts
const dek = await getDekForUser(userId)
await db.insert(debtorEntries).values({
  userId,
  personId: data.personId,
  type: data.type,
  referenceMonth: data.referenceMonth,
  entryDate: data.entryDate,
  dueDate: data.dueDate ?? null,
  status: data.status ?? null,
  sourceTransactionId: data.sourceTransactionId ?? null,
  incomeId: data.incomeId ?? null,
  description: encryptField(data.description, dek),
  amount: encryptField(String(data.amount), dek),
  notes: encryptOptional(data.notes ?? null, dek),
})
```

- [ ] **Step 2: Adicionar decrypt em `lib/queries/debtors.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
```

Em todas as funções de query que retornam `people` ou `debtorEntries`, descriptografar os campos antes de retornar. Atenção ao `getOpenChargesForPeople` que retorna `Record<string, OpenChargeForLinking[]>`.

- [ ] **Step 3: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/debtors.ts lib/queries/debtors.ts
git commit -m "feat(crypto): encrypt people and debtorEntries"
```

---

### Task 9: Criptografar pixKey e feedback

**Files:**
- Modify: `lib/actions/settings.ts`
- Modify: `lib/queries/settings.ts`
- Modify: `lib/actions/feedback.ts`

- [ ] **Step 1: Atualizar `lib/actions/settings.ts` — pixKey**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptOptional } from '@/lib/crypto/fields'
```

Em `updatePixKey`:
```ts
export async function updatePixKey(pixKey: string | null) {
  const userId = await requireUserId()
  const dek = await getDekForUser(userId)
  const encrypted = encryptOptional(pixKey, dek)
  await db.insert(userSettings)
    .values({ userId, pixKey: encrypted })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { pixKey: encrypted, updatedAt: new Date() },
    })
  revalidatePath('/devedores')
}
```

- [ ] **Step 2: Atualizar `lib/queries/settings.ts` — getUserPixKey**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptOptional } from '@/lib/crypto/fields'

export async function getUserPixKey(userId: string): Promise<string | null> {
  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { pixKey: true },
  })
  if (!row?.pixKey) return null
  const dek = await getDekForUser(userId)
  return decryptOptional(row.pixKey, dek)
}
```

- [ ] **Step 3: Adicionar encrypt em `lib/actions/feedback.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField } from '@/lib/crypto/fields'
```

Em `createFeedback`:
```ts
const dek = await getDekForUser(userId)
await db.insert(feedback).values({
  userId,
  category: data.category,
  page: data.page ?? null,
  status: 'new',
  message: encryptField(data.message, dek),
})
```

**Nota:** O admin lê `feedback.message`. A rota `/admin` usa `requireUserId` — adicionar decrypt em `lib/queries/admin.ts` (ou onde quer que feedback seja lido no admin).

- [ ] **Step 4: Atualizar leitura de feedback no admin**

Em `lib/queries/admin.ts` (ou rota `/admin`), descriptografar `message` ao retornar feedback. O admin precisa chamar `getDekForUser(feedback.userId)` para cada usuário diferente — agrupar por userId para minimizar lookups.

- [ ] **Step 5: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/actions/settings.ts lib/queries/settings.ts lib/actions/feedback.ts
git commit -m "feat(crypto): encrypt pixKey and feedback message"
```

---

### Task 10: Refatorar dashboard.ts — SQL SUM → JS aggregation + decrypt

**Files:**
- Modify: `lib/queries/dashboard.ts`

**Problema:** `getCategoryGroupProgress`, `getMonthlyEvolution`, e `getDashboardDataBillingCycle` usam `SUM()` SQL em `transactions.amount`, `fixedExpenses.amount`, `investments.amount`. Com colunas text cifradas, o PostgreSQL não consegue somar. Solução: buscar rows individuais, descriptografar, agregar em JS.

**Impacto de performance:** Fetching rows individuais em vez de agregados aumenta dados transferidos, mas é aceitável para um app de finanças pessoais (centenas, não milhões de rows por usuário).

- [ ] **Step 1: Adicionar imports em `dashboard.ts`**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
```

- [ ] **Step 2: Refatorar `getCategoryGroupProgress`**

Substituir as queries com `sum()` por fetches de rows individuais com agregação em JS:

```ts
export async function getCategoryGroupProgress(
  userId: string,
  referenceMonth: string,
  faturaCtx?: FaturaContext
) {
  const dek = await getDekForUser(userId)
  // ... WHERE clauses existentes (txWhere, fxWhere) — sem mudança ...

  const [groups, txRows, fxRows] = await Promise.all([
    db.query.categoryGroups.findMany({
      where: eq(categoryGroups.userId, userId),
      with: {
        categories: {
          with: { budgetOverrides: { where: eq(monthlyBudgetOverrides.referenceMonth, referenceMonth) } },
        },
      },
    }),
    db.select({ categoryId: transactions.categoryId, amount: transactions.amount })
      .from(transactions).where(txWhere),
    db.select({ categoryId: fixedExpenses.categoryId, amount: fixedExpenses.amount })
      .from(fixedExpenses).where(fxWhere),
  ])

  const spentMap = new Map<string, number>()
  for (const r of txRows) {
    if (!r.categoryId) continue
    spentMap.set(r.categoryId, (spentMap.get(r.categoryId) ?? 0) + toAmount(decryptField(r.amount, dek)))
  }
  for (const r of fxRows) {
    if (!r.categoryId) continue
    spentMap.set(r.categoryId, (spentMap.get(r.categoryId) ?? 0) + toAmount(decryptField(r.amount, dek)))
  }

  return groups.map((group) => {
    const categoryDetails = group.categories.map((cat) => {
      const override = cat.budgetOverrides[0]
      const budget = toAmount(decryptOptional(override?.amount ?? null, dek) ?? cat.defaultBudget)
      const spent = spentMap.get(cat.id) ?? 0
      return {
        id: cat.id,
        name: decryptField(cat.name, dek),
        color: cat.color ?? undefined,
        bgColor: cat.bgColor ?? undefined,
        budget,
        spent,
      }
    })
    const totalBudget = categoryDetails.reduce((s, c) => s + c.budget, 0)
    const totalSpent = categoryDetails.reduce((s, c) => s + c.spent, 0)
    return {
      id: group.id,
      name: decryptField(group.name, dek),
      totalBudget,
      totalSpent,
      categories: categoryDetails,
    }
  })
}
```

- [ ] **Step 3: Refatorar `getMonthlyEvolution` e outras funções com `sum()`**

Para cada função que usa `sum()`, aplicar o mesmo padrão:
1. Substituir `.select({ total: sum(col) }).groupBy(refMonth)` por `.select({ refMonth, amount: col })`
2. Descriptografar e agrupar em JS com `reduce`

Exemplo para o padrão de `getMonthlyEvolution`:
```ts
// Fetch individual rows por mês
const txRows = await db.select({
  referenceMonth: transactions.referenceMonth,
  amount: transactions.amount,
}).from(transactions).where(inArray(transactions.referenceMonth, months))

// Agrupar e somar em JS
const txByMonth = new Map<string, number>()
for (const r of txRows) {
  txByMonth.set(r.referenceMonth, (txByMonth.get(r.referenceMonth) ?? 0) + toAmount(decryptField(r.amount, dek)))
}
```

- [ ] **Step 4: Descriptografar todos os campos retornados nas funções query**

Funções como `getMonthTransactions`, `getMonthFixedExpenses`, `getMonthIncomes`, `getMonthInvestments` retornam rows diretamente. Adicionar decrypt antes do return:

```ts
export async function getMonthTransactions(userId: string, referenceMonth: string) {
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.referenceMonth, referenceMonth)),
    with: { category: true, account: true, installmentGroup: true },
    orderBy: [desc(transactions.date)],
  })
  const dek = await getDekForUser(userId)
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    category: row.category ? { ...row.category, name: decryptField(row.category.name, dek) } : null,
    account: row.account ? { ...row.account, name: decryptField(row.account.name, dek) } : null,
  }))
}
```

- [ ] **Step 5: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/queries/dashboard.ts
git commit -m "feat(crypto): decrypt dashboard queries, refactor SQL SUM to JS aggregation"
```

---

### Task 11: Refatorar panorama.ts (SQL SUM → JS) e historico.ts (search → JS)

**Files:**
- Modify: `lib/queries/panorama.ts`
- Modify: `lib/queries/historico.ts`
- Modify: `lib/queries/fatura.ts` (verificar se retorna campos cifrados)

**Problema adicional em historico.ts:** usa `ilike(transactions.name, '%q%')` para busca textual. Com `name` cifrado, essa query SQL retorna zero resultados. Solução: remover `ilike` do SQL WHERE e aplicar filtro `q` em JS após descriptografar.

- [ ] **Step 1: Refatorar `lib/queries/panorama.ts`**

Aplicar o mesmo padrão da Task 10: substituir `sum()` por fetch de rows individuais + JS aggregation + decrypt.

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'
```

Para `getAnnualOverview`, `getAnnualExpensesByGroup`: buscar rows individuais por mês (via `inArray(referenceMonth, yearMonths(year))`), descriptografar amounts, agrupar por mês em JS.

- [ ] **Step 2: Refatorar `lib/queries/historico.ts` — mover filtro `q` para JS**

```ts
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
```

Em `getHistoricoFeed`, remover `q ? ilike(..., q) : undefined` dos WHERE clauses SQL. Após fetch e decrypt de todos os campos, aplicar filtro em JS:

```ts
// Remover do WHERE:
// q ? ilike(transactions.name, `%${q}%`) : undefined

// Após buscar e descriptografar todos os rows:
let allItems = mergeAndSortFeedItems([txItems, fxItems, incomeItems, ...])

// Filtrar por q em JS após decrypt
if (q) {
  const lq = q.toLowerCase()
  allItems = allItems.filter((item) => item.name.toLowerCase().includes(lq))
}

// Paginação em JS
const startIdx = cursor ? allItems.findIndex((i) => i.id === cursor) + 1 : 0
const page = allItems.slice(startIdx, startIdx + PAGE_SIZE)
const hasMore = startIdx + PAGE_SIZE < allItems.length
const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null

return { items: page, hasMore, nextCursor }
```

**Nota:** A paginação cursor-based deixa de ser DB-level e passa a ser JS-level. O cursor agora é um item ID na lista filtrada+ordenada. O comportamento externo (retorno `{ items, hasMore, nextCursor }`) permanece idêntico.

Adicionar decrypt nos mappers de cada tabela em `getHistoricoFeed`:

```ts
const dek = await getDekForUser(userId)

// transactions mapper
const txItems: HistoricoFeedItem[] = txRows.map((t) => ({
  id: t.id,
  kind: t.installmentGroupId ? 'saida_parcelada' : 'saida_avulsa',
  name: decryptField(t.name, dek),
  amount: decryptField(t.amount, dek),
  date: t.date,
  categoryId: t.categoryId ?? null,
  categoryName: t.category ? decryptField(t.category.name, dek) : null,
  // ...
  accountName: t.account ? decryptField(t.account.name, dek) : null,
  // ...
}))

// incomes mapper
const incomeItems: HistoricoFeedItem[] = incomeRows.map((i) => ({
  id: i.id,
  kind: 'entrada',
  name: decryptField(i.source, dek),
  amount: decryptField(i.amount, dek),
  // ...
}))
```

- [ ] **Step 3: Verificar `lib/queries/fatura.ts`**

Verificar se `fatura.ts` retorna campos cifrados (names, amounts). Adicionar decrypt onde necessário seguindo o mesmo padrão.

- [ ] **Step 4: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/queries/panorama.ts lib/queries/historico.ts lib/queries/fatura.ts
git commit -m "feat(crypto): decrypt panorama/historico queries, move search filter to JS"
```

---

### Task 12: Script de migração para dados existentes

**Files:**
- Create: `scripts/encrypt-existing-data.ts`

**Objetivo:** Criptografar todos os dados existentes no banco. O script é idempotente: detecta valores já cifrados pelo prefixo `enc:` e os pula. Roda uma única vez em produção.

- [ ] **Step 1: Criar `scripts/encrypt-existing-data.ts`**

```ts
#!/usr/bin/env npx tsx
/**
 * Criptografa dados existentes no banco usando o DEK de cada usuário.
 * Idempotente: campos com prefixo 'enc:' são pulados.
 *
 * Uso:
 *   npx tsx scripts/encrypt-existing-data.ts --dry-run  # imprime contagens sem modificar
 *   npx tsx scripts/encrypt-existing-data.ts             # aplica criptografia
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { eq, isNull, or } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { generateDek, encryptDek, decryptDek } from '../lib/crypto/keys'
import { encryptField, encryptOptional } from '../lib/crypto/fields'

const isDryRun = process.argv.includes('--dry-run')
const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const db = drizzle(pool, { schema })

const PREFIX = 'enc:'
function isEncrypted(val: string | null | undefined): boolean {
  return val != null && val.startsWith(PREFIX)
}

async function getOrCreateDek(userId: string): Promise<Buffer> {
  const row = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
    columns: { encryptedDek: true },
  })

  if (row?.encryptedDek) return decryptDek(row.encryptedDek)

  const dek = generateDek()
  const encryptedDekVal = encryptDek(dek)

  if (!isDryRun) {
    await db.insert(schema.userSettings)
      .values({ userId, encryptedDek: encryptedDekVal })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { encryptedDek: encryptedDekVal },
      })
  }
  return dek
}

async function main() {
  console.log(isDryRun ? '[DRY RUN] Nenhuma modificação será feita.' : '[APLICANDO] Criptografando dados...')

  const users = await db.select({ id: schema.users.id }).from(schema.users)
  console.log(`Usuários encontrados: ${users.length}`)

  let totalUpdated = 0

  for (const { id: userId } of users) {
    const dek = await getOrCreateDek(userId)
    let userUpdated = 0

    // ─── transactions ───────────────────────────────────────────────────────
    const txRows = await db.select({ id: schema.transactions.id, name: schema.transactions.name, amount: schema.transactions.amount })
      .from(schema.transactions).where(eq(schema.transactions.userId, userId))

    for (const row of txRows) {
      if (isEncrypted(row.name) && isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db.update(schema.transactions).set({
          name: isEncrypted(row.name) ? row.name : encryptField(row.name, dek),
          amount: isEncrypted(row.amount) ? row.amount : encryptField(row.amount, dek),
        }).where(eq(schema.transactions.id, row.id))
      }
      userUpdated++
    }

    // ─── fixedExpenses ──────────────────────────────────────────────────────
    const fxRows = await db.select({ id: schema.fixedExpenses.id, name: schema.fixedExpenses.name, amount: schema.fixedExpenses.amount })
      .from(schema.fixedExpenses).where(eq(schema.fixedExpenses.userId, userId))

    for (const row of fxRows) {
      if (isEncrypted(row.name) && isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db.update(schema.fixedExpenses).set({
          name: isEncrypted(row.name) ? row.name : encryptField(row.name, dek),
          amount: isEncrypted(row.amount) ? row.amount : encryptField(row.amount, dek),
        }).where(eq(schema.fixedExpenses.id, row.id))
      }
      userUpdated++
    }

    // ─── installmentGroups ──────────────────────────────────────────────────
    const igRows = await db.select({ id: schema.installmentGroups.id, name: schema.installmentGroups.name, totalAmount: schema.installmentGroups.totalAmount })
      .from(schema.installmentGroups).where(eq(schema.installmentGroups.userId, userId))

    for (const row of igRows) {
      if (isEncrypted(row.name) && isEncrypted(row.totalAmount)) continue
      if (!isDryRun) {
        await db.update(schema.installmentGroups).set({
          name: isEncrypted(row.name) ? row.name : encryptField(row.name, dek),
          totalAmount: isEncrypted(row.totalAmount) ? row.totalAmount : encryptField(row.totalAmount, dek),
        }).where(eq(schema.installmentGroups.id, row.id))
      }
      userUpdated++
    }

    // ─── incomes ────────────────────────────────────────────────────────────
    const incRows = await db.select({ id: schema.incomes.id, source: schema.incomes.source, amount: schema.incomes.amount, investmentReturnCapital: schema.incomes.investmentReturnCapital })
      .from(schema.incomes).where(eq(schema.incomes.userId, userId))

    for (const row of incRows) {
      if (isEncrypted(row.source) && isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db.update(schema.incomes).set({
          source: isEncrypted(row.source) ? row.source : encryptField(row.source, dek),
          amount: isEncrypted(row.amount) ? row.amount : encryptField(row.amount, dek),
          investmentReturnCapital: isEncrypted(row.investmentReturnCapital) ? row.investmentReturnCapital : encryptOptional(row.investmentReturnCapital, dek),
        }).where(eq(schema.incomes.id, row.id))
      }
      userUpdated++
    }

    // ─── investments ────────────────────────────────────────────────────────
    const invRows = await db.select({ id: schema.investments.id, amount: schema.investments.amount, yieldAmount: schema.investments.yieldAmount, notes: schema.investments.notes })
      .from(schema.investments).where(eq(schema.investments.userId, userId))

    for (const row of invRows) {
      const needsUpdate = !isEncrypted(row.amount) || !isEncrypted(row.yieldAmount) || (row.notes && !isEncrypted(row.notes))
      if (!needsUpdate) continue
      if (!isDryRun) {
        await db.update(schema.investments).set({
          amount: isEncrypted(row.amount) ? row.amount : encryptOptional(row.amount, dek),
          yieldAmount: isEncrypted(row.yieldAmount) ? row.yieldAmount : encryptOptional(row.yieldAmount, dek),
          notes: isEncrypted(row.notes) ? row.notes : encryptOptional(row.notes, dek),
        }).where(eq(schema.investments.id, row.id))
      }
      userUpdated++
    }

    // ─── investmentWithdrawals ──────────────────────────────────────────────
    const wdRows = await db.select({ id: schema.investmentWithdrawals.id, amount: schema.investmentWithdrawals.amount, taxAmount: schema.investmentWithdrawals.taxAmount, notes: schema.investmentWithdrawals.notes })
      .from(schema.investmentWithdrawals).where(eq(schema.investmentWithdrawals.userId, userId))

    for (const row of wdRows) {
      if (isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db.update(schema.investmentWithdrawals).set({
          amount: encryptField(row.amount, dek),
          taxAmount: encryptOptional(row.taxAmount, dek),
          notes: encryptOptional(row.notes, dek),
        }).where(eq(schema.investmentWithdrawals.id, row.id))
      }
      userUpdated++
    }

    // ─── goals ──────────────────────────────────────────────────────────────
    const goalRows = await db.select({ id: schema.goals.id, name: schema.goals.name, targetAmount: schema.goals.targetAmount })
      .from(schema.goals).where(eq(schema.goals.userId, userId))

    for (const row of goalRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db.update(schema.goals).set({
          name: encryptField(row.name, dek),
          targetAmount: encryptField(row.targetAmount, dek),
        }).where(eq(schema.goals.id, row.id))
      }
      userUpdated++
    }

    // ─── investmentTypes ────────────────────────────────────────────────────
    const itRows = await db.select({ id: schema.investmentTypes.id, name: schema.investmentTypes.name })
      .from(schema.investmentTypes).where(eq(schema.investmentTypes.userId, userId))

    for (const row of itRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db.update(schema.investmentTypes).set({ name: encryptField(row.name, dek) })
          .where(eq(schema.investmentTypes.id, row.id))
      }
      userUpdated++
    }

    // ─── paymentAccounts ────────────────────────────────────────────────────
    const paRows = await db.select({ id: schema.paymentAccounts.id, name: schema.paymentAccounts.name })
      .from(schema.paymentAccounts).where(eq(schema.paymentAccounts.userId, userId))

    for (const row of paRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db.update(schema.paymentAccounts).set({ name: encryptField(row.name, dek) })
          .where(eq(schema.paymentAccounts.id, row.id))
      }
      userUpdated++
    }

    // ─── categoryGroups ─────────────────────────────────────────────────────
    const cgRows = await db.select({ id: schema.categoryGroups.id, name: schema.categoryGroups.name })
      .from(schema.categoryGroups).where(eq(schema.categoryGroups.userId, userId))

    for (const row of cgRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db.update(schema.categoryGroups).set({ name: encryptField(row.name, dek) })
          .where(eq(schema.categoryGroups.id, row.id))
      }
      userUpdated++
    }

    // ─── categories ─────────────────────────────────────────────────────────
    const catRows = await db.select({ id: schema.categories.id, name: schema.categories.name, defaultBudget: schema.categories.defaultBudget })
      .from(schema.categories).where(eq(schema.categories.userId, userId))

    for (const row of catRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db.update(schema.categories).set({
          name: encryptField(row.name, dek),
          defaultBudget: encryptOptional(row.defaultBudget, dek),
        }).where(eq(schema.categories.id, row.id))
      }
      userUpdated++
    }

    // ─── monthlyBudgetOverrides ─────────────────────────────────────────────
    const mboRows = await db.select({ id: schema.monthlyBudgetOverrides.id, amount: schema.monthlyBudgetOverrides.amount })
      .from(schema.monthlyBudgetOverrides).where(eq(schema.monthlyBudgetOverrides.userId, userId))

    for (const row of mboRows) {
      if (isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db.update(schema.monthlyBudgetOverrides).set({ amount: encryptField(row.amount, dek) })
          .where(eq(schema.monthlyBudgetOverrides.id, row.id))
      }
      userUpdated++
    }

    // ─── goalContributions ──────────────────────────────────────────────────
    const gcRows = await db.select({ id: schema.goalContributions.id, amount: schema.goalContributions.amount })
      .from(schema.goalContributions).where(eq(schema.goalContributions.userId, userId))

    for (const row of gcRows) {
      if (isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db.update(schema.goalContributions).set({ amount: encryptField(row.amount, dek) })
          .where(eq(schema.goalContributions.id, row.id))
      }
      userUpdated++
    }

    // ─── people ─────────────────────────────────────────────────────────────
    const pRows = await db.select({ id: schema.people.id, name: schema.people.name, email: schema.people.email, phone: schema.people.phone, notes: schema.people.notes })
      .from(schema.people).where(eq(schema.people.userId, userId))

    for (const row of pRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db.update(schema.people).set({
          name: encryptField(row.name, dek),
          email: encryptOptional(row.email, dek),
          phone: encryptOptional(row.phone, dek),
          notes: encryptOptional(row.notes, dek),
        }).where(eq(schema.people.id, row.id))
      }
      userUpdated++
    }

    // ─── debtorEntries ──────────────────────────────────────────────────────
    const deRows = await db.select({ id: schema.debtorEntries.id, description: schema.debtorEntries.description, amount: schema.debtorEntries.amount, notes: schema.debtorEntries.notes })
      .from(schema.debtorEntries).where(eq(schema.debtorEntries.userId, userId))

    for (const row of deRows) {
      if (isEncrypted(row.description)) continue
      if (!isDryRun) {
        await db.update(schema.debtorEntries).set({
          description: encryptField(row.description, dek),
          amount: encryptField(row.amount, dek),
          notes: encryptOptional(row.notes, dek),
        }).where(eq(schema.debtorEntries.id, row.id))
      }
      userUpdated++
    }

    // ─── userSettings.pixKey ────────────────────────────────────────────────
    const settingsRow = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
      columns: { pixKey: true },
    })
    if (settingsRow?.pixKey && !isEncrypted(settingsRow.pixKey)) {
      if (!isDryRun) {
        await db.update(schema.userSettings)
          .set({ pixKey: encryptField(settingsRow.pixKey, dek) })
          .where(eq(schema.userSettings.userId, userId))
      }
      userUpdated++
    }

    // ─── feedback ───────────────────────────────────────────────────────────
    const fbRows = await db.select({ id: schema.feedback.id, message: schema.feedback.message })
      .from(schema.feedback).where(eq(schema.feedback.userId, userId))

    for (const row of fbRows) {
      if (isEncrypted(row.message)) continue
      if (!isDryRun) {
        await db.update(schema.feedback).set({ message: encryptField(row.message, dek) })
          .where(eq(schema.feedback.id, row.id))
      }
      userUpdated++
    }

    console.log(`  userId=${userId}: ${userUpdated} registros ${isDryRun ? 'a cifrar' : 'cifrados'}`)
    totalUpdated += userUpdated
  }

  console.log(`\nTotal: ${totalUpdated} registros ${isDryRun ? 'seriam cifrados' : 'cifrados com sucesso'}.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Rodar em dry-run para validar**

```bash
npx tsx scripts/encrypt-existing-data.ts --dry-run
```

Expected: imprime contagens por usuário sem modificar nada

- [ ] **Step 3: Rodar a migração real**

```bash
npx tsx scripts/encrypt-existing-data.ts
```

Expected: todos os registros cifrados; rodar novamente deve mostrar 0 registros a processar

- [ ] **Step 4: Verificar no Drizzle Studio que os campos exibem valores `enc:...`**

```bash
npm run db:studio
```

Abrir `transactions` → confirmar que `name` e `amount` mostram `enc:<base64>`

- [ ] **Step 5: Commit**

```bash
git add scripts/encrypt-existing-data.ts
git commit -m "feat(crypto): add migration script to encrypt existing data"
```

---

## Checklist de Verificação Final

Antes de considerar a feature completa, verificar:

- [ ] `npm run lint && npm run format:check && npm run typecheck && npm test` passam sem erros
- [ ] App rodando localmente (`npm run dev`) com `ENCRYPTION_MASTER_KEY` no `.env.local` — criar transação, recarregar página, confirmar que valor aparece corretamente
- [ ] Dashboard exibe totais corretos após criptografia (testar com dado real)
- [ ] Busca no histórico funciona para uma transação existente cifrada
- [ ] `npm run db:studio` mostra colunas de valor/nome com prefixo `enc:`
- [ ] Adicionar `ENCRYPTION_MASTER_KEY` às variáveis de ambiente do Vercel antes do deploy
- [ ] Rodar `scripts/encrypt-existing-data.ts` contra o banco de produção **antes** de fazer deploy do código novo
