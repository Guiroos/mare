# Testing — Índice

Esta pasta organiza a estratégia de testes do Maré e o plano de melhoria contínua
da suíte automatizada.

## Status em 26/05/2026

| Fase | Objetivo | Status |
| ---- | -------- | ------ |
| 1 | Testes unitários com Vitest | concluída |
| 2 | Integração de schema com Neon branch por arquivo | concluída |
| 2.5 | Testes de actions e queries | parcial |
| 3 | E2E com Playwright | pendente |
| 4 | CI com integração Neon | concluída |
| 5 | Hardening de infraestrutura de testes | parcial |

**Próximo passo recomendado:** resolver a semântica de exclusão de
`deleteInstallmentGroup` e avançar nos testes de action (P1).

---

## Resumo Executivo

A fundação atual é boa: `npm test` roda rápido, os testes unitários cobrem
helpers sensíveis de dinheiro/data/validação, e a suíte de integração com
`neon-testing` valida constraints reais do PostgreSQL em branches descartáveis.

O maior risco hoje não é ferramenta, é arquitetura de garantia:

1. O documento antigo mistura blueprint, checklist e estado atual.
2. A cobertura unitária inclui `actions` e `queries`, mas essas pastas não rodam
   nessa suíte.
3. Parte dos testes de integração replica lógica de action em vez de chamar a
   action real.
4. A suíte Neon depende de convenções manuais de import dinâmico e variáveis de
   ambiente sem preflight forte.
5. Não há CI versionado para executar integração em pull requests.

## Arquivos

| Arquivo | Conteúdo |
| ------- | -------- |
| [01-contexto-e-escopo.md](./01-contexto-e-escopo.md) | Objetivos, camadas, comandos e estado atual |
| [02-arquitetura-e-integracoes.md](./02-arquitetura-e-integracoes.md) | Como Vitest, Neon, Drizzle, Next e Husky se conectam |
| [03-achados-criticos.md](./03-achados-criticos.md) | Code smells, riscos, inconsistências e recomendações |
| [04-roadmap-melhoria-continua.md](./04-roadmap-melhoria-continua.md) | Ordem de ataque com critérios de aceite |
| [05-referencia-operacional.md](./05-referencia-operacional.md) | Padrões práticos para escrever e rodar testes |
| [implementacao-testes.md](./implementacao-testes.md) | Ponte histórica para a versão consolidada anterior |

## Referências

- Scripts: `package.json`
- Unitários: `vitest.config.ts`, `__tests__/unit/`
- Integração: `vitest.integration.config.ts`, `__tests__/integration/`
- Setup Neon: `__tests__/integration/setup.ts`
- Helpers: `__tests__/integration/helpers/`
- Regras locais: `.claude/testing.md`, `__tests__/CLAUDE.md`
- Pre-push: `.husky/pre-push`
