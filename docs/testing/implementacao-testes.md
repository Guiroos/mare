# Implementação de Testes — Maré

## Visão geral

Três camadas de teste, cada uma com escopo e ferramenta definidos:

| Camada | Ferramenta | O que testa |
|---|---|---|
| Unitária | Vitest | Funções puras, schemas Zod |
| Integração (schema) | Vitest + `neon-testing` | Invariantes de banco: constraints, FKs, transactions |
| Integração (actions) | Vitest + `neon-testing` | Lógica de negócio das server actions com banco real |
| E2E | Playwright | Fluxos críticos no browser |

### Estado atual da cobertura

| Pasta | Cobertura | Observação |
|---|---|---|
| `lib/utils/` | Alta | Unitários para `currency`, `date`, `validations` |
| `lib/db/schema` | Alta | Contratos FK/constraint cobertos pelos testes de integração |
| `lib/actions/` | **Zero** | Maior gap — auth, ownership, lógica de negócio não testados |
| `lib/queries/` | **Zero** | Queries de aggregação (`getDashboardData`, `getAnnualOverview`) não testadas |

---

## Fase 1 — Setup do Vitest (unitários)

### 1.1 Instalar dependências

```bash
npm install --save-exact --save-dev vitest@3 @vitejs/plugin-react@4 @vitest/coverage-v8@3
```

### 1.2 Criar `vitest.config.ts` na raiz

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

### 1.3 Adicionar scripts ao `package.json`

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 1.4 Primeiros arquivos de teste

Criar pasta `__tests__/unit/`.

**`__tests__/unit/date.test.ts`** — cobre os helpers de `lib/utils/date.ts`:
- `yearMonthToReferenceMonth` (ex: `"2025-03"` → `"2025-03-01"`)
- `referenceMonthToYearMonth` (inverso)
- `prevMonth` / `nextMonth` (virada de ano, janeiro, dezembro)
- `billingCycleDateRange` com diferentes `closingDay` (1, 15, 28, último dia do mês)
- Datas com sufixo `T12:00:00` não devem sofrer UTC shift

**`__tests__/unit/currency.test.ts`** — cobre `lib/utils/currency.ts`:
- `toAmount` com strings decimais do Drizzle (`"1234.50"`, `"0"`, `"-99.99"`)
- `formatCurrency` com valores negativos, zero e grandes
- `formatCurrencyShort` (ex: `42900` → `"R$ 42,9k"`, `1200000` → `"R$ 1,2M"`)

**`__tests__/unit/validations.test.ts`** — cobre `lib/validations/utils.ts`:
- `positiveAmountSchema` rejeita zero e negativo
- `nonNegativeAmountSchema` aceita zero, rejeita negativo
- `nullishNonNegativeAmountSchema` aceita undefined/null e zero
- `yearMonthSchema` rejeita formatos inválidos (`"2025-13"`, `"25-01"`, `""`)
- `referenceMonthSchema` rejeita dias diferentes de `01`

---

## Fase 2 — Integração com banco real (`neon-testing`)

### Por que banco real e não mock

As actions do Maré têm lógica que depende de restrições do banco:
- `uniqueIndex` em `monthlyBudgetOverrides` (`.onConflictDoUpdate`)
- FK self-referente em `debtorEntries.settledByPaymentId`
- `ON DELETE SET NULL` que **não reseta `status`** — requer UPDATE explícito antes do DELETE
- `db.transaction()` com rollback atômico

Mocks de banco não detectariam falhas nessas situações. A `neon-testing` cria um branch Neon por arquivo de teste com o schema completo, isolado e descartável.

### O desafio de testar as server actions

As server actions importam `@/lib/db`, que inicializa `new Pool({ connectionString: process.env.DATABASE_URL })` no nível do módulo. Imports estáticos capturam a URL no momento do import — antes do `beforeAll` do neon-testing setar a URL do branch de teste, o que causaria conexão com o banco de dev.

**Solução: dynamic imports dentro do `beforeAll`**. Como Vitest com `pool: 'forks'` roda cada arquivo num processo separado, nenhum módulo está pré-carregado. O `beforeAll` do neon-testing seta `DATABASE_URL` para o branch de teste antes do nosso `beforeAll`. Importando a action dinamicamente dentro do nosso `beforeAll`, o `lib/db` é inicializado com a URL correta.

`vi.mock` é hoistado pelo compilador Vitest — pode ficar no topo do arquivo e afeta imports dinâmicos também. Módulos importados dinamicamente múltiplas vezes retornam o mesmo cache — sem overhead por `it()`.

Os testes de schema da Fase 2 (constraints, FKs) continuam válidos e necessários: testam invariantes que não passam pela camada de application. Os testes de action da Fase 2.5 cobrem a lógica de negócio, validação e checks de autorização — camadas distintas.

### 2.1 Instalar dependências

```bash
npm install --save-exact --save-dev neon-testing
```

### 2.2 Variáveis de ambiente

Adicionar ao `.env.local`:

```
NEON_API_KEY=          # token em console.neon.tech → Account → API Keys
NEON_PROJECT_ID=       # ID do projeto (URL do console)
NEON_PARENT_BRANCH_ID= # ID do branch dev (br_xxx) — testes clonam deste branch
```

`NEON_PARENT_BRANCH_ID` garante que os branches de teste clonam do dev (com schema atualizado), nunca do prod. O ID fica em console.neon.tech → Branches → dev.

Branches de teste são criados e destruídos automaticamente por arquivo. Migrations não precisam rodar — o schema é herdado do branch pai.

### 2.3 Criar `vitest.integration.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['__tests__/integration/env-setup.ts'],
    include: ['__tests__/integration/**/*.test.ts'],
    pool: 'forks',                               // cada arquivo = processo isolado = branch isolado
    poolOptions: { forks: { singleFork: false } },
    testTimeout: 30000,                          // branches Neon levam alguns segundos
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Adicionar script ao `package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

### 2.4 Carregar variáveis de ambiente (`__tests__/integration/env-setup.ts`)

`setupFiles` roda dentro de cada worker antes dos módulos serem importados. `neon-testing/vite` (que limparia `DATABASE_URL` automaticamente) é ESM-only e incompatível com o bundler CJS do projeto — o `dotenv` resolve sem essa dependência.

```ts
import { config } from 'dotenv'
import { join } from 'path'

config({ path: join(process.cwd(), '.env.local'), override: false })
```

### 2.5 Setup do neon-testing (`__tests__/integration/setup.ts`)

```ts
import { makeNeonTesting } from 'neon-testing'

export const neonTestingSetup = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
  parentBranchId: process.env.NEON_PARENT_BRANCH_ID,
  autoCloseWebSockets: true, // obrigatório para neon-serverless (Pool WebSocket)
})
```

### 2.6 Helper de conexão (`__tests__/integration/helpers/db.ts`)

```ts
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@/lib/db/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>>

export function createTestDb(): TestDb {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  return drizzle(pool, { schema })
}
```

Chamar dentro do `beforeAll`, após o neon-testing setar `DATABASE_URL`:

```ts
neonTestingSetup() // registra beforeAll/afterAll do neon-testing — deve estar no escopo global

let db: TestDb

beforeAll(async () => {
  db = createTestDb() // DATABASE_URL já está correto aqui
})
```

### 2.7 Factories (`__tests__/integration/helpers/factories.ts`)

Funções que encapsulam inserções de fixture com defaults sobrescrevíveis via `overrides`. Evitam repetição de `db.insert(schema.users).values(...)` em cada arquivo de teste.

```ts
export async function createUser(db: TestDb, suffix: string | number = Date.now())
export async function createPerson(db: TestDb, userId: string, name?: string)
export async function createCategoryGroup(db: TestDb, userId: string, name?: string)
export async function createCategory(db: TestDb, userId: string, groupId: string, overrides?)
export async function createAccount(db: TestDb, userId: string, overrides?)
export async function createCharge(db: TestDb, userId: string, personId: string, overrides?)
export async function createPayment(db: TestDb, userId: string, personId: string, overrides?)
```

**Gotcha: `createTransaction` não tem `categoryId` default.** A check constraint `transactions_fatura_category_check` exige `categoryId IS NOT NULL` quando `faturaAccountId IS NULL`. Chamar `createTransaction(db, userId, accountId)` sem overrides falha com erro de constraint. Sempre passar `{ categoryId }` via overrides para transações comuns:

```ts
// correto
await createTransaction(db, userId, accountId, { categoryId })

// falha na constraint do banco
await createTransaction(db, userId, accountId)
```

### 2.8 Padrão de cada arquivo de teste

```ts
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson } from './helpers/factories'

neonTestingSetup() // escopo global — não dentro de describe/beforeAll

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `nome-do-arquivo-${Date.now()}`))
  // demais fixtures do arquivo
})
```

**Isolamento entre testes**: cada teste cria suas próprias entidades (usando as factories). Estado de módulo (`userId`, `personId`) é compartilhado no arquivo — usar sufixos únicos para evitar colisões e sempre filtrar por ID específico em vez de por `userId` + tipo genérico.

### 2.9 O que cada arquivo de integração testa

**`debtors.test.ts`** ✅:
- Pessoa criada com `archived=false` por padrão
- `archivePerson` seta `archived=true` sem deletar a row
- `deletePersonIfEmpty` — impede deleção quando há entries (replica a guarda da action)
- `settleCharge` — `db.transaction` cria payment e marca charge como `settled` atomicamente
- `deleteDebtEntry` — UPDATE explícito de `status='open'` antes do DELETE (sem ele, `ON DELETE SET NULL` limpa `settledByPaymentId` mas não reseta `status`)
- `createDebtPayment` com `settleChargeIds` — apenas as charges especificadas são vinculadas (charges de outras pessoas não são afetadas)
- `createDebtPayment` com `createIncome` — income e payment compartilham `incomeId`; deletar com `alsoDeleteIncome` limpa ambos

**`transactions.test.ts`** ✅:
- N transações criadas com nomes `"<name> (i/N)"`
- `installmentGroupId` e `totalInstallments` presentes em todas as parcelas
- `referenceMonth` correto na virada de ano (nov → dez → jan → fev)

**`budgets.test.ts`** ✅:
- Upsert via `onConflictDoUpdate` — sem duplicatas, valor atualizado
- Meses diferentes criam rows independentes
- Insert sem `onConflictDoUpdate` lança erro com chave duplicada

---

### 2.10 Próximos arquivos de integração (não implementados)

Ordenados por prioridade. Os três primeiros blindam fluxos destrutivos — deleção de entidades com dependentes, onde o banco é a última barreira.

**`investments.test.ts`** — alta prioridade:
- Upsert via `onConflictDoUpdate` em `[userId, investmentTypeId, referenceMonth]` — confirma que o unique index existe no banco (mesmo padrão do `budgets`, índice diferente)
- `createWithdrawal` com `destination: 'income'` — `db.transaction` cria `investmentWithdrawals` + `incomes` atomicamente; falha no meio não deve persistir nenhum row
- `investmentWithdrawals.incomeId` tem `ON DELETE SET NULL` — deletar o income vinculado nulifica `incomeId` no withdrawal mas não deleta a row do withdrawal
- `investments.goalId` tem `ON DELETE SET NULL` — deletar o goal nulifica o campo em investments sem deletar a row

**`categories.test.ts`** — alta prioridade:
- `transactions.categoryId` tem `onDelete: 'restrict'` — tentar deletar categoria com transações vinculadas lança erro de FK no banco (não só na UI)
- Deleção de `categoryGroup` tem cascade para `categories` — se a categoria tem transações (`restrict`), a cascade falha; esse encadeamento é um gotcha real

**`payment-accounts.test.ts`** — alta prioridade:
- `fixedExpenses.accountId` e `transactions.accountId` têm `onDelete: 'restrict'` — deletar conta com gastos fixos ou transações vinculadas deve falhar no banco

**`installments-delete.test.ts`** — alta prioridade:
- `transactions.installmentGroupId` tem `onDelete: 'set null'` — deletar o `installmentGroup` deixa as N transações órfãs (`installmentGroupId = null`), não as deleta em cascata; comportamento não-óbvio que vale estar documentado

**`goals.test.ts`** — média prioridade:
- `goalContributions` tem `onDelete: 'cascade'` na FK para `goals` — deletar o goal apaga todas as contribuições automaticamente
- `investments.goalId` com `ON DELETE SET NULL` — teste cruzado: deletar goal nulifica o campo em investments sem deletar a row

**`fatura.test.ts`** — média prioridade:
- `userSettings` upsert via `onConflictDoUpdate` em `userId` — chamar `updateCreditMode` duas vezes não cria duas rows
- Guard de "não trocar regime enquanto houver pagamentos de fatura" — verificação feita por query na action (não é constraint do banco); o teste documenta explicitamente onde está a barreira

### 2.11 Casos adicionais identificados (não implementados)

São casos que pertencem a arquivos já existentes — não requerem novo arquivo, só novos `it()` dentro do `describe` correspondente.

**`investments.test.ts`** — alta prioridade:
- `investmentTypes.id` tem `onDelete: 'restrict'` em `investments` — deletar um tipo com aportes vinculados deve falhar no banco
- `investmentTypes.id` tem `onDelete: 'restrict'` em `investmentWithdrawals` — deletar um tipo com resgates vinculados deve falhar no banco

**`payment-accounts.test.ts`** — média prioridade:
- `installmentGroups.accountId` tem `onDelete: 'restrict'` — deletar conta com grupos de parcelamento vinculados deve falhar; não coberto pelos casos de transactions/fixedExpenses já existentes

**`categories.test.ts`** — média prioridade:
- `installmentGroups.categoryId` tem `onDelete: 'restrict'` — deletar categoria com grupos de parcelamento vinculados deve falhar; o encadeamento testado atualmente é apenas via `transactions.categoryId`

**`debtors.test.ts`** — média prioridade:
- `debtorEntries.sourceTransactionId` tem `ON DELETE SET NULL` — deletar uma transação vinculada a uma entry deve nulificar `sourceTransactionId` sem deletar a entry
- `debtorEntries.incomeId` tem `ON DELETE SET NULL` — deletar um income vinculado a uma entry deve nulificar `incomeId` sem deletar a entry

### 2.12 Decisões de design

**Não testar `revalidatePath`**: é efeito colateral do Next.js, sem impacto no banco. Testes de integração verificam estado persistido, não side effects de cache.

**Não usar `beforeEach` com truncate**: isolamento por ID (cada teste cria dados próprios) é suficiente e mais rápido que truncar tabelas entre testes.

**Teste documentando bug latente** (`ON DELETE SET NULL`): o teste `'ON DELETE SET NULL não reseta status — UPDATE explícito é obrigatório'` falha propositalmente sem o guard da action. Mantê-lo garante que qualquer refactor que remova o UPDATE seja imediatamente detectado.

**Não replicar lógica de action nos testes de schema**: testes de schema verificam invariantes do banco, não a corretude das actions. Se o teste precisa reproduzir o que a action faria, o alvo correto é a Fase 2.5 (testes de action), não a Fase 2.

**Coverage de `lib/actions` e `lib/queries`**: o `vitest.config.ts` inclui essas pastas no `coverage.include`, mas a cobertura atual é zero. Manter o coverage config como aspiracional só é útil se houver testes. Antes de adicionar os primeiros testes de action, o relatório de coverage é enganoso.

---

## Fase 2.5 — Testes de actions e queries

Esta fase cobre a camada de aplicação: as `lib/actions/` (mutations com auth + validação + DB) e as `lib/queries/` (reads complexos). É a camada com maior gap de cobertura e onde mais bugs de regressão escapam.

### Padrão de arquivo para testes de action

```ts
import { vi, describe, it, expect, beforeAll } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createCategoryGroup, createCategory, createAccount } from './helpers/factories'

// vi.mock é hoistado — afeta imports dinâmicos também
vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))
vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsCategory: vi.fn(),
  assertOwnsAccount: vi.fn(),
  assertOwnsGroup: vi.fn(),
  assertOwnsGoal: vi.fn(),
  assertOwnsPerson: vi.fn(),
  assertOwnsDebtEntry: vi.fn(),
  assertOwnsInvestmentType: vi.fn(),
})

neonTestingSetup()

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-feature-${Date.now()}`))

  // Configurar mocks depois que neon-testing setou DATABASE_URL
  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
})
```

Em cada `it()` que testa um caminho específico, importar a action dinamicamente:

```ts
it('cria entidade e persiste no banco', async () => {
  const { createSomething } = await import('@/lib/actions/something')
  const result = await createSomething(new FormData())
  // verificar estado no banco via db.query
})
```

### O que testar em cada action

Para cada action, cobrir os três caminhos:

1. **Caminho feliz**: dados válidos → entidade criada/atualizada no banco
2. **Validação de schema**: dados inválidos (amount negativo, mês fora de formato) → action retorna erro sem gravar nada
3. **Check de ownership**: IDs que não pertencem ao `userId` → action rejeita (testar com `mockRejectedValueOnce`)

Exemplo de estrutura para `createTransaction`:

```ts
describe('createTransaction', () => {
  it('cria transação com dados válidos', async () => { ... })
  it('rejeita amount zero', async () => { ... })
  it('rejeita categoryId de outro userId', async () => {
    const { assertOwnsCategory } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsCategory).mockRejectedValueOnce(new Error('Forbidden'))
    // chamar a action — deve propagar o erro
  })
})
```

### Arquivos prioritários para Fase 2.5

**`__tests__/integration/actions-debtors.test.ts`** — alta prioridade:
- `settleCharge`: chama a action real, verifica no banco que status='settled' e settledByPaymentId está preenchido
- `deleteDebtEntry` com payment vinculado: verifica que o UPDATE de status='open' acontece antes da deleção (a versão atual em `debtors.test.ts` reimplementa a lógica — esse arquivo a testaria via action real)
- `createDebtPayment` com `createIncome: true`: verifica que o income foi criado E o payment tem o `incomeId` correto

**`__tests__/integration/actions-transactions.test.ts`** — alta prioridade:
- `createInstallments`: verifica N transações criadas com nomes corretos e `installmentGroupId` compartilhado
- `deleteInstallmentGroup`: verifica que as transações ficam órfãs (não são deletadas)

**`__tests__/integration/queries-dashboard.test.ts`** — média prioridade:
- `getDashboardData`: inserir transações e gastos fixos, verificar que os totais do summary batem com os dados inseridos
- Verificar que transações de outro `userId` não contaminam os totais

### Por que as queries também precisam de testes

`lib/queries/dashboard.ts` usa o padrão `IN + GROUP BY` com 4 queries para N meses. Bugs nessas queries só aparecem quando há dados reais em múltiplos meses e múltiplas categorias. Testes de query com banco real cobrem:
- Filtro por `userId` (sem vazamento de dados entre usuários)
- Filtro por `referenceMonth` (transações do mês anterior não entram no mês atual)
- Aggregations corretas (soma de amounts, contagem de pendências)

O padrão de setup é idêntico aos testes de schema (factories para dados, `createTestDb()` no `beforeAll`), mas sem mocks de auth — as queries recebem `userId` diretamente como parâmetro.

---

## Fase 3 — E2E com Playwright

O Playwright MCP já está configurado para desenvolvimento interativo. Para testes automatizados, adicionar uma suite formal.

### 3.1 Instalar dependências

```bash
npm install --save-exact --save-dev @playwright/test
npx playwright install chromium
```

### 3.2 `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '__tests__/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
})
```

### 3.3 Fluxos prioritários

Criar pasta `__tests__/e2e/`.

**`__tests__/e2e/login.spec.ts`**:
- Rota `/dashboard` sem sessão redireciona para `/login`
- Botão de Google OAuth visível (não testar o OAuth em si — depende de conta real)

**`__tests__/e2e/registro.spec.ts`** (requer usuário de teste autenticado via `storageState`):
- Abrir drawer de registro, preencher transação de despesa, submeter
- Transação aparece na lista do dashboard
- Abrir drawer, cancelar → estado é descartado

**`__tests__/e2e/devedores.spec.ts`**:
- Criar pessoa, criar cobrança, quitar cobrança → fluxo completo

> Para E2E autenticado: salvar sessão via `playwright/auth.setup.ts` com um usuário de teste dedicado (conta Google de teste ou mock do NextAuth em test mode).

---

## Ordem de execução recomendada

```
Fase 1 → Fase 2 → Fase 2.5 → Fase 3
unitários → schema/constraints → actions/queries → E2E
```

Cada fase entrega valor independentemente. A Fase 2 (schema) está completa. A Fase 2.5 (actions) é a próxima fronteira — cobre a camada onde a maioria dos bugs de regressão acontece.

---

## Estrutura de pastas

```
__tests__/
  unit/
    date.test.ts           ✅
    currency.test.ts       ✅
    validations.test.ts    ✅
  integration/
    helpers/
      db.ts                # createTestDb()
      factories.ts         # createUser, createPerson, createAccount, createCategory, ...
    env-setup.ts           # setupFiles: carrega .env.local via dotenv nos workers forks
    setup.ts               # neonTestingSetup via makeNeonTesting
    # --- Fase 2: schema/constraints (✅ completo) ---
    debtors.test.ts              ✅
    transactions.test.ts         ✅
    budgets.test.ts              ✅
    investments.test.ts          ✅
    categories.test.ts           ✅
    payment-accounts.test.ts     ✅
    installments-delete.test.ts  ✅
    goals.test.ts                ✅
    fatura.test.ts               ✅
    # --- Fase 2.5: actions/queries (pendente) ---
    actions-debtors.test.ts      ⬜ settleCharge, deleteDebtEntry, createDebtPayment
    actions-transactions.test.ts ⬜ createInstallments, deleteInstallmentGroup
    queries-dashboard.test.ts    ⬜ getDashboardData totals, filtro por userId/mês
  e2e/                           # Fase 3
    login.spec.ts
    registro.spec.ts
    devedores.spec.ts
vitest.config.ts
vitest.integration.config.ts
playwright.config.ts
```

---

## Checklist de implementação

### Fase 1 — Unitários
- [x] Instalar `vitest` + `@vitejs/plugin-react` + `@vitest/coverage-v8`
- [x] Criar `vitest.config.ts`
- [x] Adicionar scripts `test`, `test:watch`, `test:coverage` ao `package.json`
- [x] Criar `__tests__/unit/date.test.ts`
- [x] Criar `__tests__/unit/currency.test.ts`
- [x] Criar `__tests__/unit/validations.test.ts`

### Fase 2 — Integração
- [x] Instalar `neon-testing`
- [x] Adicionar `NEON_API_KEY`, `NEON_PROJECT_ID` e `NEON_PARENT_BRANCH_ID` ao `.env.local`
- [x] Criar `vitest.integration.config.ts` com `setupFiles` e `pool: 'forks'`
- [x] Criar `__tests__/integration/env-setup.ts`
- [x] Criar `__tests__/integration/setup.ts`
- [x] Criar `__tests__/integration/helpers/db.ts`
- [x] Criar `__tests__/integration/helpers/factories.ts`
- [x] Criar `__tests__/integration/debtors.test.ts`
- [x] Criar `__tests__/integration/transactions.test.ts`
- [x] Criar `__tests__/integration/budgets.test.ts`
- [x] Criar `__tests__/integration/investments.test.ts`
- [x] Criar `__tests__/integration/categories.test.ts`
- [x] Criar `__tests__/integration/payment-accounts.test.ts`
- [x] Criar `__tests__/integration/installments-delete.test.ts`
- [x] Criar `__tests__/integration/goals.test.ts`
- [x] Criar `__tests__/integration/fatura.test.ts`

#### Casos adicionais (arquivos existentes)
- [x] `investments.test.ts` — restrict ao deletar `investmentType` com aportes vinculados
- [x] `investments.test.ts` — restrict ao deletar `investmentType` com resgates vinculados
- [x] `payment-accounts.test.ts` — restrict ao deletar conta com `installmentGroups` vinculados
- [x] `categories.test.ts` — restrict ao deletar categoria com `installmentGroups` vinculados
- [x] `debtors.test.ts` — `ON DELETE SET NULL` em `debtorEntries.sourceTransactionId`
- [x] `debtors.test.ts` — `ON DELETE SET NULL` em `debtorEntries.incomeId`

### Fase 2.5 — Actions e queries (pendente)
- [ ] Criar `__tests__/integration/actions-debtors.test.ts`
  - [ ] `settleCharge` — action real cria payment e marca charge como settled
  - [ ] `deleteDebtEntry` com payment vinculado — action real executa UPDATE antes de DELETE
  - [ ] `createDebtPayment` com `createIncome: true` — income criado e `incomeId` vinculado
- [ ] Criar `__tests__/integration/actions-transactions.test.ts`
  - [ ] `createInstallments` — N transações com nomes corretos e `installmentGroupId` compartilhado
  - [ ] deleção de `installmentGroup` — transações ficam com `installmentGroupId = null`
- [ ] Criar `__tests__/integration/queries-dashboard.test.ts`
  - [ ] totais do summary somam apenas transações do `userId` e `referenceMonth` corretos
  - [ ] transações de outro `userId` não contaminam os resultados

### Fase 3 — E2E
- [ ] Instalar `@playwright/test` + browsers
- [ ] Criar `playwright.config.ts`
- [ ] Criar `__tests__/e2e/login.spec.ts`
- [ ] Criar `__tests__/e2e/registro.spec.ts`
- [ ] Criar `__tests__/e2e/devedores.spec.ts`

### Fase 4 — CI (GitHub Actions)

Os testes de integração **não devem entrar no Husky** (pre-push). Fazem chamadas de rede ao Neon API — se a API estiver fora ou lenta, bloqueia qualquer push, inclusive de docs. O lugar correto é CI, rodando em PRs antes do merge.

O pre-push continua com: `format:check + lint + typecheck + npm test` (unitários — locais e rápidos).

- [ ] Criar `.github/workflows/ci.yml` disparado em `pull_request` (branch `main`)
- [ ] Adicionar `NEON_API_KEY`, `NEON_PROJECT_ID` e `NEON_PARENT_BRANCH_ID` como secrets no repositório GitHub
- [ ] Workflow executa: `npm run lint && npm run typecheck && npm test && npm run test:integration`
- [ ] Considerar cache de `node_modules` (`actions/cache`) para reduzir tempo de execução

Estrutura mínima do workflow:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:integration
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
          NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
          NEON_PARENT_BRANCH_ID: ${{ secrets.NEON_PARENT_BRANCH_ID }}
```
