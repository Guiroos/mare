# Implementação de Testes — Maré

## Visão geral

Três camadas de teste, cada uma com escopo e ferramenta definidos:

| Camada | Ferramenta | O que testa |
|---|---|---|
| Unitária | Vitest | Funções puras, schemas Zod |
| Integração | Vitest + `neon-testing` | Invariantes de banco: constraints, FKs, transactions |
| E2E | Playwright | Fluxos críticos no browser |

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

### Por que testar a camada de banco, não as server actions

As server actions importam `@/lib/db`, que inicializa `new Pool({ connectionString: process.env.DATABASE_URL })` no nível do módulo. Isso captura a URL no momento do import — antes do `beforeAll` do neon-testing rodar e setar a URL do branch de teste. Importar as actions nos testes causaria conexão com o banco de produção/dev.

A alternativa seria mockar `@/lib/db` inteiro, o que remove o valor do teste de integração. A abordagem correta é testar as operações de banco diretamente, criando a conexão dentro do `beforeAll` (após o neon-testing setar `DATABASE_URL`).

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

**`debtors.test.ts`**:
- Pessoa criada com `archived=false` por padrão
- `archivePerson` seta `archived=true` sem deletar a row
- `deletePersonIfEmpty` — impede deleção quando há entries (replica a guarda da action)
- `settleCharge` — `db.transaction` cria payment e marca charge como `settled` atomicamente
- `deleteDebtEntry` — UPDATE explícito de `status='open'` antes do DELETE (sem ele, `ON DELETE SET NULL` limpa `settledByPaymentId` mas não reseta `status`)
- `createDebtPayment` com `settleChargeIds` — apenas as charges especificadas são vinculadas (charges de outras pessoas não são afetadas)
- `createDebtPayment` com `createIncome` — income e payment compartilham `incomeId`; deletar com `alsoDeleteIncome` limpa ambos

**`transactions.test.ts`**:
- N transações criadas com nomes `"<name> (i/N)"`
- `installmentGroupId` e `totalInstallments` presentes em todas as parcelas
- `referenceMonth` correto na virada de ano (nov → dez → jan → fev)

**`budgets.test.ts`**:
- Upsert via `onConflictDoUpdate` — sem duplicatas, valor atualizado
- Meses diferentes criam rows independentes
- Insert sem `onConflictDoUpdate` lança erro com chave duplicada

### 2.10 Decisões de design

**Não testar `revalidatePath`**: é efeito colateral do Next.js, sem impacto no banco. Testes de integração verificam estado persistido, não side effects de cache.

**Não usar `beforeEach` com truncate**: isolamento por ID (cada teste cria dados próprios) é suficiente e mais rápido que truncar tabelas entre testes.

**Teste documentando bug latente** (`ON DELETE SET NULL`): o teste `'ON DELETE SET NULL não reseta status — UPDATE explícito é obrigatório'` falha propositalmente sem o guard da action. Mantê-lo garante que qualquer refactor que remova o UPDATE seja imediatamente detectado.

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
Fase 1 → Fase 2 → Fase 3
unitários → integração → E2E
```

Cada fase entrega valor independentemente. É possível parar na Fase 2 e já ter cobertura significativa das regras de negócio críticas.

---

## Estrutura de pastas

```
__tests__/
  unit/
    date.test.ts
    currency.test.ts
    validations.test.ts
  integration/
    helpers/
      db.ts           # createTestDb()
      factories.ts    # createUser, createPerson, createAccount, createCategory, createCharge, createPayment
    env-setup.ts      # setupFiles: carrega .env.local via dotenv nos workers forks
    setup.ts          # neonTestingSetup via makeNeonTesting
    debtors.test.ts
    transactions.test.ts
    budgets.test.ts
  e2e/
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
