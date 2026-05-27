# Testing — Referência Operacional

## Padrão de Teste Unitário

Use unitários para funções puras e validações que não precisam de banco.

Exemplos atuais:

- `__tests__/unit/currency.test.ts`
- `__tests__/unit/date.test.ts`
- `__tests__/unit/validations.test.ts`

Características:

- import estático normal;
- sem setup de banco;
- sem rede;
- rápido o bastante para pre-push.

## Padrão de Teste de Schema

Use integração de schema quando o comportamento alvo é o próprio banco:

- `uniqueIndex`;
- `onConflictDoUpdate`;
- `onDelete: restrict`;
- `onDelete: cascade`;
- `onDelete: set null`;
- rollback de transaction;
- constraints que Drizzle/TypeScript não capturam.

Estrutura:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'

neonTestingSetup()

let db: TestDb

beforeAll(async () => {
  db = createTestDb()
})
```

Regras:

- chamar `neonTestingSetup()` no escopo global;
- criar DB apenas após o setup Neon;
- usar factories para fixtures comuns;
- filtrar por IDs específicos, não por dados genéricos;
- não importar actions em testes de schema.

## Padrão de Teste de Action

Use integração de action quando o alvo é regra de aplicação:

- auth;
- ownership;
- validação;
- escrita no banco;
- transaction de negócio;
- efeitos persistidos.

Estrutura:

```ts
import { vi, describe, it, expect, beforeAll } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'

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

beforeAll(async () => {
  db = createTestDb()

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
})
```

Dentro do teste:

```ts
it('cria entidade no banco', async () => {
  const { createTransaction } = await import('@/lib/actions/transactions')

  await createTransaction(data)

  // verificar estado persistido com db.query ou select
})
```

Regras:

- action real deve ser importada dinamicamente;
- não reimplementar a lógica da action no teste;
- mocks de ownership devem ter casos de sucesso e falha;
- verificar estado final no banco;
- evitar assert principal em `revalidatePath`.

## Padrão de Teste de Query

Use integração de query para leituras agregadas e filtros.

Dados mínimos recomendados:

- usuário principal;
- segundo usuário para detectar vazamento;
- mês alvo;
- mês fora do alvo;
- pelo menos uma categoria, conta, transação, entrada e gasto fixo quando o
  cenário envolver dashboard.

Assertions recomendadas:

- totais numéricos;
- quantidade de registros;
- ausência de dados de outro usuário;
- ausência de dados de outro mês;
- aplicação correta de overrides.

## Factories

Factories atuais ficam em `__tests__/integration/helpers/factories.ts`.

Pontos de atenção:

- `createTransaction` não define `categoryId` por padrão; passe `{ categoryId }`
  para transações comuns.
- `userSettings` exige par coerente entre `creditMode` e `faturaActiveFrom`.
- fixtures devem criar entidades por teste quando o estado puder ser mutado.
- usar sufixos únicos em usuários evita colisão entre arquivos.

## Neon

Antes de rodar integração:

```bash
NEON_API_KEY=
NEON_PROJECT_ID=
NEON_PARENT_BRANCH_ID=
```

Boas práticas:

- usar branch pai de desenvolvimento;
- limitar forks para não exceder branches simultâneos;
- nunca rodar migrations dentro dos testes;
- deixar `autoCloseWebSockets: true`;
- se a suíte falhar por branch leak, verificar branches temporários no console
  Neon antes de aumentar paralelismo.

## O Que Entra no Pre-push

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

O que não entra:

- `npm run test:integration`;
- Playwright completo;
- comandos que dependem de rede externa;
- qualquer comando que crie branches Neon.

## O Que Entra no CI

O workflow está em `.github/workflows/ci.yml` com dois jobs:

**`validate`** — roda em todo PR e push para `main`:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

**`integration`** — roda apenas em push para `main`, após `validate` passar:

```bash
npm run test:integration
```

Secrets necessários no repositório GitHub:

```
NEON_API_KEY
NEON_PROJECT_ID
NEON_PARENT_BRANCH_ID
```

### Configurar proteção de branch

Em `github.com/<repo> → Settings → Branches → Add rule` para `main`:

1. Marcar **"Require status checks to pass before merging"**
2. Adicionar o check **`Lint, Typecheck & Unit Tests`**
3. Marcar **"Require branches to be up to date before merging"**

### Configurar Vercel Required Checks (opcional)

Em `vercel.com/<projeto> → Settings → Git → Required Checks`:

- Adicionar **`Lint, Typecheck & Unit Tests`**

Isso bloqueia a promoção de deploys de preview até o check passar.
