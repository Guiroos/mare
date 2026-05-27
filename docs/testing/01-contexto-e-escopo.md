# Testing — Contexto e Escopo

## Objetivo

Criar uma suíte de testes que proteja as regras financeiras centrais do Maré sem
tornar o fluxo local lento ou frágil.

O Maré tem regras que dependem de banco real: `uniqueIndex`,
`onDelete: restrict`, `onDelete: set null`, transactions SQL e filtros por
`userId`/`referenceMonth`. Por isso a estratégia combina testes unitários rápidos
com integração em PostgreSQL real via `neon-testing`.

## Camadas

| Camada | Ferramenta | Status | Responsabilidade |
| ------ | ---------- | ------ | ---------------- |
| Unitária | Vitest | concluída | Funções puras, schemas Zod e helpers de domínio |
| Integração de schema | Vitest + `neon-testing` | concluída | Constraints, FKs, cascades, restricts e upserts reais |
| Integração de actions | Vitest + `neon-testing` | parcial | Server actions com auth mockado, validação e persistência real |
| Integração de queries | Vitest + `neon-testing` | concluída | Aggregations, filtros por usuário/mês e vazamento entre usuários |
| E2E | Playwright | pendente | Fluxos críticos no browser |
| CI | GitHub Actions | pendente | Rodar lint, typecheck, unitários e integração em PR |

## Estado Atual

### Implementado

- `vitest.config.ts` para unitários.
- `vitest.integration.config.ts` para integração.
- `__tests__/unit/` com `currency`, `date` e `validations`.
- `__tests__/integration/` cobrindo constraints e relações de banco em vários
  domínios.
- `__tests__/integration/actions-debtors.test.ts` cobrindo parte das actions de
  devedores.
- `.husky/pre-push` com `format:check`, `lint`, `typecheck` e unitários.

### Pendente

- CI versionado em `.github/workflows/ci.yml`.
- Preflight obrigatório para variáveis Neon.
- Testes de action para `transactions`.
- Testes de query para `dashboard`.
- Playwright formal.
- Separação mais clara entre coverage unitário e coverage de integração.

## Comandos Recomendados

### Local rápido

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

### Integração com banco real

```bash
npm run test:integration
```

Requer:

```bash
NEON_API_KEY=
NEON_PROJECT_ID=
NEON_PARENT_BRANCH_ID=
```

`NEON_PARENT_BRANCH_ID` deve apontar para o branch de desenvolvimento, nunca para
produção.

### Coverage

```bash
npm run test:coverage
```

Hoje esse relatório deve ser lido com cuidado: ele roda apenas a configuração
unitária, mas inclui `lib/actions/**` e `lib/queries/**` no escopo de cobertura.
Isso torna o percentual global pouco útil até a cobertura de integração ser
separada.

## Não Objetivos

- Não mockar Drizzle/PostgreSQL para testar constraints.
- Não colocar testes Neon no pre-push.
- Não testar OAuth real do Google em E2E.
- Não tratar `revalidatePath` como critério principal de integração.

## Decisões Atuais

- Unitários ficam no pre-push porque são rápidos e determinísticos.
- Integração com Neon deve rodar manualmente e em CI, não em hook local.
- Testes de schema podem usar SQL/Drizzle direto.
- Testes de action devem importar e chamar a action real.
- Queries complexas devem ser testadas com dados reais, incluindo outro `userId`
  para detectar vazamento.
