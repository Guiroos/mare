# Testing — Gotchas de infraestrutura

Referenciado por `CLAUDE.md` via `@`. Cobre a configuração de testes de integração com `neon-testing` e quirks descobertos na implementação.

---

## Configuração do Vitest (4.x)

- **Extensão `.mts` obrigatória nos configs**: quando o projeto não tem `"type": "module"`, Vite 7 carrega `vitest.config.ts` em modo CJS — quebra com deps ESM-only (ex: `std-env@4`); renomear para `vitest.config.mts` força Vite 7 a usar `import()` ESM e resolve o problema; mesmo vale para `vitest.integration.config.mts`
- **`__dirname` não existe em arquivos `.mts`**: substituir por `import.meta.dirname` (disponível desde Node 21.2; projeto exige ≥22)
- **`vi.useFakeTimers({ toFake: ['Date'] })` no Vitest 4.x**: `vi.useFakeTimers()` sem parâmetros faz fake de `setImmediate`/`process.nextTick` internos do Vitest, travando `afterEach` com timeout; quando só é preciso controlar `Date`, sempre passar `{ toFake: ['Date'] }`
- **`poolOptions` removido no Vitest 4.x**: `poolOptions: { forks: { maxForks: N } }` não existe mais em `InlineConfig`; usar `maxWorkers: N` no topo de `test:` — o limite de branches do Neon continua sendo controlado via `maxWorkers: 4`

## Setup do neon-testing

- **API atual**: `makeNeonTesting` importado de `neon-testing` (não `neonTestingSetup` de `neon-testing/vitest` — esse export não existe na versão ≥ 2.x)
- **`neon-testing/vite` é ESM-only**: importar o plugin no `vitest.integration.config.mts` falha com `[plugin: externalize-deps] Failed to resolve "neon-testing/vite"` porque o bundler do projeto é CJS; substituir por `setupFiles` com `dotenv.config({ path: '.env.local' })` em `__tests__/integration/env-setup.ts`
- **`autoCloseWebSockets: true` obrigatório**: quando usando `Pool` de `@neondatabase/serverless`, omitir essa opção faz o cleanup do branch falhar silenciosamente com conexões WebSocket abertas
- **`parentBranchId` obrigatório**: sem ele, neon-testing clona do branch default do projeto (prod); sempre passar `NEON_PARENT_BRANCH_ID` apontando para o branch dev — o ID fica em console.neon.tech → Branches
- **Branches são clones — sem migrations**: o branch de teste herda o schema completo do pai; nunca chamar `migrate()` nos testes
- **Neon hobby plan — `maxForks: 4`**: o plano hobby tem limite de 10 branches por projeto; com 2 branches fixos (prod + dev), restam 8 slots; sem `maxForks`, todos os arquivos criam branches em paralelo e os últimos falham com `BRANCHES_LIMIT_EXCEEDED`; `maxForks: 4` garante no máximo 6 branches simultâneos (4 test + 2 fixos), com margem para branches lentos a destruir

## Carregamento de variáveis de ambiente

- **Vitest `pool: 'forks'` não repassa `.env.local` aos workers**: o processo principal carrega as vars, mas os workers forked não as herdam corretamente; `setupFiles` com `dotenv.config({ override: false })` roda dentro de cada worker antes de qualquer import e resolve o problema

## Padrão de arquivo de teste

- **`neonTestingSetup()` no escopo global do arquivo**: não chamar dentro de `describe` ou `beforeAll` — a função registra hooks do Vitest e precisa existir antes da coleta de testes; o hook do neon-testing roda antes do `beforeAll` local porque foi registrado primeiro
- **`createTestDb()` dentro do `beforeAll`**: `lib/db/index.ts` executa `new Pool({ connectionString: process.env.DATABASE_URL })` no nível do módulo — captura a URL no momento do import, antes do `beforeAll` do neon-testing setar a URL do branch de teste; importar actions (que importam `lib/db`) em testes de integração conecta ao banco errado; solução: criar a conexão dentro do `beforeAll`, após o neon-testing setar `DATABASE_URL`
- **Ao testar `onConflictDoUpdate`, sempre incluir um caso de insert raw sem o clause**: se o unique index não existir no banco, o `.onConflictDoUpdate` nunca dispara — simplesmente insere a linha duplicada sem erro; o caso de insert raw que lança constraint error é a única forma de confirmar que o índice realmente existe no banco de teste
- **Testes não devem replicar lógica de action**: se o teste define uma função local que reproduz o que a action faz (ex: `deleteIfEmpty` em `debtors.test.ts`), a regressão na action real não é detectada; o objetivo dos testes de action é importar e chamar a função real, não reimplementar a lógica dela

## Factory — gotchas

- **`createTransaction` exige `categoryId` via overrides**: a factory não tem `categoryId` nos defaults; a check constraint `transactions_fatura_category_check` do banco rejeita qualquer `INSERT` sem `categoryId` e sem `faturaAccountId` — chamadas sem override falham com erro de constraint enigmático; sempre passar `categoryId` via overrides em testes que criam transações comuns
- **Isolamento por ID, não por truncate**: os factories criam usuários com sufixo único (`Date.now()`); não confiar em isolamento por ordem de execução — filtrar sempre por ID específico; testes dentro do mesmo arquivo compartilham `userId`, o que é suficiente desde que cada teste crie suas próprias entidades
- **`userSettings` exige par consistente `(creditMode, faturaActiveFrom)`**: a constraint `user_settings_credit_mode_check` rejeita `creditMode='fatura'` sem `faturaActiveFrom` e `creditMode='accrual'` com `faturaActiveFrom` não-null; ao inserir diretamente em testes, sempre passar o par: `{ creditMode: 'accrual', faturaActiveFrom: null }` ou `{ creditMode: 'fatura', faturaActiveFrom: '2025-01-01' }`

## Testando actions com banco real

O desafio: `lib/db/index.ts` cria o `Pool` no nível do módulo. Imports estáticos de actions capturam a `DATABASE_URL` antes do neon-testing setar a URL do branch.

**Solução: dynamic import dentro do `beforeAll`**

```ts
// vi.mock é hoistado — pode ficar no topo
vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn(),
}))
vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsCategory: vi.fn(),
  assertOwnsAccount: vi.fn(),
  // ... outros que a action usar
}))

neonTestingSetup()

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `actions-${Date.now()}`))

  // Dynamic import: lib/db só é resolvido aqui, após neon-testing setar DATABASE_URL
  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)

  const { assertOwnsCategory } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsCategory).mockResolvedValue(undefined)
})
```

Depois, no teste:
```ts
it('action cria entidade no banco', async () => {
  const { createTransaction } = await import('@/lib/actions/transactions')
  const result = await createTransaction(formData)
  // verificar no banco via db.query...
})
```

**Pontos de atenção:**
- `revalidatePath` **precisa** de mock — sem ele lança `"Invariant: static generation store missing in revalidatePath"` em ambiente de teste; adicionar `vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))` no topo de todo arquivo que chama actions reais
- Para assertar que a action revalidou um path: `import { revalidatePath } from 'next/cache'` estático no topo (vi.mock é hoisted, então o import já recebe o mock), `vi.mocked(revalidatePath).mockClear()` imediatamente **antes** da chamada de action no `it`, e `expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/path')` depois — o `mockClear()` isolado por teste evita que chamadas de `it` anteriores contaminem a assertion
- Cada `await import(...)` dentro de `it()` retorna o módulo já cacheado — performance OK
- Mocks de ownership devem ser configurados antes dos imports de action no `beforeAll`; se a action chamar `assertOwns*` com um ID que não pertence ao usuário, o mock por padrão resolve sem erro — cobrir o caminho de erro com `vi.mocked(assertOwnsCategory).mockRejectedValueOnce(new Error('Forbidden'))`
- Adicionar `toHaveBeenCalledWith(userId, entityId)` após chamar a action no caminho feliz — verifica que o check de ownership foi invocado com os IDs corretos, não só que foi chamado
- `afterEach` para restaurar `vi.mocked(requireUserId).mockResolvedValue(userId)` em arquivos que testam rejeição de auth: `mockRejectedValueOnce` deixa o valor não consumido se a action lança antes de chegar ao mock (ex: falha de validação de schema), contaminando o próximo teste
- **IDs de "outro usuário" devem ser UUIDs válidos**: schemas Zod validam formato UUID antes de chegar ao `assertOwns*`; strings como `'id-de-outro-usuario'` fazem o schema rejeitar primeiro, o `mockRejectedValueOnce` fica não-consumido e contamina o teste seguinte; usar `const FOREIGN_UUID = '00000000-0000-0000-0000-000000000000'` como sentinela — passa a validação de schema e chega ao ownership check normalmente
- Para testar que uma action usa `db.transaction()`, importar `@/lib/db` dinamicamente e espiar o método: `const { db: actionDb } = await import('@/lib/db')` + `vi.spyOn(actionDb, 'transaction')` → assertar `toHaveBeenCalledOnce()` → `transactionSpy.mockRestore()`. Funciona porque action e teste compartilham o mesmo singleton do módulo; o spy intercepta chamadas da action sem quebrar o comportamento real
