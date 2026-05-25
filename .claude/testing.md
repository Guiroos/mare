# Testing — Gotchas de infraestrutura

Referenciado por `CLAUDE.md` via `@`. Cobre a configuração de testes de integração com `neon-testing` e quirks descobertos na implementação.

---

## Setup do neon-testing

- **API atual**: `makeNeonTesting` importado de `neon-testing` (não `neonTestingSetup` de `neon-testing/vitest` — esse export não existe na versão ≥ 2.x)
- **`neon-testing/vite` é ESM-only**: importar o plugin no `vitest.integration.config.ts` falha com `[plugin: externalize-deps] Failed to resolve "neon-testing/vite"` porque o bundler do projeto é CJS; substituir por `setupFiles` com `dotenv.config({ path: '.env.local' })` em `__tests__/integration/env-setup.ts`
- **`autoCloseWebSockets: true` obrigatório**: quando usando `Pool` de `@neondatabase/serverless`, omitir essa opção faz o cleanup do branch falhar silenciosamente com conexões WebSocket abertas
- **`parentBranchId` obrigatório**: sem ele, neon-testing clona do branch default do projeto (prod); sempre passar `NEON_PARENT_BRANCH_ID` apontando para o branch dev — o ID fica em console.neon.tech → Branches
- **Branches são clones — sem migrations**: o branch de teste herda o schema completo do pai; nunca chamar `migrate()` nos testes

## Carregamento de variáveis de ambiente

- **Vitest `pool: 'forks'` não repassa `.env.local` aos workers**: o processo principal carrega as vars, mas os workers forked não as herdam corretamente; `setupFiles` com `dotenv.config({ override: false })` roda dentro de cada worker antes de qualquer import e resolve o problema

## Padrão de arquivo de teste

- **`neonTestingSetup()` no escopo global do arquivo**: não chamar dentro de `describe` ou `beforeAll` — a função registra hooks do Vitest e precisa existir antes da coleta de testes; o hook do neon-testing roda antes do `beforeAll` local porque foi registrado primeiro
- **`createTestDb()` dentro do `beforeAll`**: `lib/db/index.ts` executa `new Pool({ connectionString: process.env.DATABASE_URL })` no nível do módulo — captura a URL no momento do import, antes do `beforeAll` do neon-testing setar a URL do branch de teste; importar actions (que importam `lib/db`) em testes de integração conecta ao banco errado; solução: criar a conexão dentro do `beforeAll`, após o neon-testing setar `DATABASE_URL`
