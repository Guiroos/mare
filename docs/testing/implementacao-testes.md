# Implementação de Testes — Maré

## Visão geral

Três camadas de teste, cada uma com escopo e ferramenta definidos:

| Camada | Ferramenta | O que testa |
|---|---|---|
| Unitária | Vitest | Funções puras, schemas Zod |
| Integração | Vitest + `neon-testing` | Server actions e queries contra banco real |
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
- `ON DELETE SET NULL` que não reseta `status` (requer UPDATE explícito antes)
- `db.transaction()` com rollback atômico

Mocks de banco não detectariam falhas nessas situações. A `neon-testing` cria um branch Neon por arquivo de teste com o schema completo, isolado e descartável.

### 2.1 Instalar dependências

```bash
npm install --save-exact --save-dev neon-testing
```

### 2.2 Pré-requisito: variável de ambiente

A `neon-testing` precisa de um token da API Neon para criar/destruir branches. Adicionar ao `.env.local` (e ao `.env.example`):

```
NEON_API_KEY=          # token gerado em console.neon.tech → Account → API Keys
NEON_PROJECT_ID=       # ID do projeto Neon (aparece na URL do console)
```

Também criar `.env.test` (não commitar) com as mesmas variáveis para o ambiente de CI futuramente.

### 2.3 Criar `vitest.integration.config.ts`

Config separada para os testes de integração, para não misturar com os unitários:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/**/*.test.ts'],
    // cada arquivo roda em processo separado para branch isolado
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
    testTimeout: 30000, // branches Neon levam alguns segundos para provisionar
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

### 2.4 Helper de setup do banco (`__tests__/integration/setup.ts`)

```ts
import { neonTestingSetup } from 'neon-testing/vitest'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { neon } from '@neondatabase/serverless'

export function setupTestDb() {
  // cria branch Neon isolado para este arquivo de teste
  const { connectionString } = neonTestingSetup()

  let db: ReturnType<typeof drizzle>

  beforeAll(async () => {
    const sql = neon(connectionString)
    db = drizzle(sql)
    // aplica todas as migrations do projeto no branch de teste
    await migrate(db, { migrationsFolder: 'lib/db/migrations' })
  })

  return { getDb: () => db }
}
```

### 2.5 Arquivos de integração prioritários

Criar pasta `__tests__/integration/`.

**`__tests__/integration/debtors.test.ts`** — actions mais complexas:
- `createPerson` → pessoa criada com `userId` correto
- `settleCharge` → cria payment, marca charge como `settled`, `settledByPaymentId` preenchido
- `deleteDebtEntry` para um payment com charges vinculadas → charges voltam para `open` antes de deletar (validar que o UPDATE explícito rodou antes do ON DELETE SET NULL)
- `createDebtPayment` com `settleChargeIds` → vincula corretamente
- `createDebtPayment` com `createIncome: true` → cria row em `incomes` e entry em `debtorEntries`
- `deletePersonIfEmpty` com histórico → deve falhar; `archivePerson` → seta `archived: true`

**`__tests__/integration/transactions.test.ts`**:
- Criação de installment group cria N transactions nomeadas `"<name> (i/N)"`
- Delete de transaction revalida paths corretos

**`__tests__/integration/budgets.test.ts`**:
- `onConflictDoUpdate` em `monthlyBudgetOverrides` — upsert idempotente
- Fallback correto para `category.defaultBudget` quando não há override

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

## Estrutura de pastas final

```
__tests__/
  unit/
    date.test.ts
    currency.test.ts
    validations.test.ts
  integration/
    setup.ts
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
- [ ] Instalar `vitest` + `@vitejs/plugin-react` + `@vitest/coverage-v8`
- [ ] Criar `vitest.config.ts`
- [ ] Adicionar scripts `test`, `test:watch`, `test:coverage` ao `package.json`
- [ ] Criar `__tests__/unit/date.test.ts`
- [ ] Criar `__tests__/unit/currency.test.ts`
- [ ] Criar `__tests__/unit/validations.test.ts`

### Fase 2 — Integração
- [ ] Instalar `neon-testing`
- [ ] Adicionar `NEON_API_KEY` e `NEON_PROJECT_ID` ao `.env.local`
- [ ] Criar `vitest.integration.config.ts`
- [ ] Criar `__tests__/integration/setup.ts`
- [ ] Criar `__tests__/integration/debtors.test.ts`
- [ ] Criar `__tests__/integration/transactions.test.ts`
- [ ] Criar `__tests__/integration/budgets.test.ts`

### Fase 3 — E2E
- [ ] Instalar `@playwright/test` + browsers
- [ ] Criar `playwright.config.ts`
- [ ] Criar `__tests__/e2e/login.spec.ts`
- [ ] Criar `__tests__/e2e/registro.spec.ts`
- [ ] Criar `__tests__/e2e/devedores.spec.ts`
