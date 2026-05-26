# Testing — Arquitetura e Integrações

## Pacotes

| Pacote | Uso |
| ------ | --- |
| `vitest` | Runner unitário e de integração |
| `@vitejs/plugin-react` | Transformação TSX/React no Vitest |
| `@vitest/coverage-v8` | Relatório de coverage |
| `neon-testing` | Branch Neon descartável por arquivo de integração |
| `dotenv` | Carregar `.env.local` dentro dos workers do Vitest |
| `@neondatabase/serverless` | Pool usado pela aplicação e pelos testes |
| `drizzle-orm` | Query builder e schema compartilhado |

## Scripts

| Script | Função |
| ------ | ------ |
| `npm test` | Unitários via `vitest.config.ts` |
| `npm run test:watch` | Unitários em watch mode |
| `npm run test:coverage` | Coverage da configuração unitária |
| `npm run test:integration` | Integração via `vitest.integration.config.ts` |
| `npm run typecheck` | TypeScript em toda a base, incluindo testes |

## Vitest Unitário

`vitest.config.ts` usa:

- ambiente `node`;
- `globals: true`;
- include restrito a `__tests__/unit/**/*.test.ts`;
- alias `@` para a raiz do projeto;
- coverage com `v8`.

Ponto de atenção: a configuração de coverage inclui `lib/actions/**` e
`lib/queries/**`, mas a suíte unitária não executa os testes de integração que
cobrem actions. Isso distorce o percentual global.

## Vitest de Integração

`vitest.integration.config.ts` usa:

- ambiente `node`;
- `setupFiles: ['__tests__/integration/env-setup.ts']`;
- include restrito a `__tests__/integration/**/*.test.ts`;
- `pool: 'forks'`;
- `maxForks: 4`;
- timeout maior para criação de branches Neon.

`maxForks: 4` é uma decisão operacional importante para o plano Hobby da Neon.
Sem limite, muitos arquivos criam branches ao mesmo tempo e a suíte pode falhar
por limite de branches.

## Neon Testing

`__tests__/integration/setup.ts` cria o setup com `makeNeonTesting`.

Contrato esperado:

- `NEON_API_KEY` precisa existir.
- `NEON_PROJECT_ID` precisa existir.
- `NEON_PARENT_BRANCH_ID` precisa apontar para o branch de desenvolvimento.
- `autoCloseWebSockets: true` precisa estar ativo para cleanup do
  `@neondatabase/serverless`.

Code smell atual: o código usa `process.env.NEON_PARENT_BRANCH_ID` diretamente.
Na prática, a variável é obrigatória para evitar clonar o branch default do
projeto por engano. A suíte deve falhar cedo se ela estiver ausente.

## Drizzle e Captura de `DATABASE_URL`

`lib/db/index.ts` instancia o pool no topo do módulo:

```ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
export const db = drizzle(pool, { schema })
```

Isso cria uma restrição forte para testes de action: qualquer import estático de
uma action pode carregar `lib/db` antes do `neon-testing` trocar
`DATABASE_URL` para o branch descartável.

Padrão atual:

- `neonTestingSetup()` no escopo global do arquivo.
- `createTestDb()` dentro de `beforeAll`.
- imports dinâmicos de actions depois que o branch Neon já foi criado.
- mocks de auth/ownership configurados antes do primeiro import da action.

Esse padrão funciona, mas é frágil por convenção. Uma melhoria arquitetural
futura é tornar a conexão lazy ou injetável em testes.

## Auth e Ownership em Actions

Actions reais dependem de:

- `requireUserId()`;
- `assertOwnsCategory*`;
- `assertOwnsPaymentAccount`;
- `assertOwnsPerson`;
- `assertOwnsDebtEntry`;
- outros asserts por domínio.

Nos testes de action, `requireUserId` e ownership são mockados, mas o banco segue
real. Esse é um bom compromisso para testar persistência sem depender de uma
sessão NextAuth real.

O teste deve cobrir:

- caminho feliz;
- validação inválida;
- falha de ownership;
- usuário não autenticado quando fizer sentido;
- se o assert de ownership foi chamado com o ID correto.

## Husky e CI

`.husky/pre-push` executa:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

Isso está correto para o fluxo local: integração Neon faz chamadas de rede e não
deve bloquear push local.

Lacuna atual: não há workflow versionado rodando `npm run test:integration` em
pull requests. Sem CI, a suíte de integração mais valiosa depende de execução
manual.

## Playwright

Playwright ainda não está formalizado no repo.

Quando entrar, o alvo inicial deve ser pequeno:

- rota autenticada redireciona para login;
- registro de despesa aparece no dashboard;
- fluxo de devedores cria pessoa, cobrança e quitação;
- fluxo autenticado com usuário de teste ou modo de auth controlado.

OAuth Google real não deve ser testado como caminho obrigatório.
