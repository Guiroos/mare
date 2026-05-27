# Testing — Índice

Esta pasta organiza a estratégia de testes do Maré e o plano de melhoria contínua
da suíte automatizada.

## Status em 26/05/2026

| Fase | Objetivo | Status |
| ---- | -------- | ------ |
| 1 | Testes unitários com Vitest | concluída |
| 2 | Integração de schema com Neon branch por arquivo | concluída |
| 2.5 | Testes de actions e queries | concluída |
| 3 | E2E com Playwright | pendente |
| 4 | CI com integração Neon | concluída |
| 5 | Hardening de infraestrutura de testes | parcial |

**Próximo passo recomendado:** separar coverage unitário e integração (P2.7) ou adicionar Playwright (P3.9).

---

## Resumo Executivo

A fundação atual é boa: `npm test` roda rápido, os testes unitários cobrem
helpers sensíveis de dinheiro/data/validação, e a suíte de integração com
`neon-testing` valida constraints reais do PostgreSQL em branches descartáveis.

O maior risco hoje não é ferramenta, é cobertura de borda:

1. A cobertura unitária inclui `actions` e `queries` no escopo, mas essas pastas
   só são validadas na suíte de integração — o relatório de coverage global é
   pouco confiável até P2.7 ser implementado.
2. Não há testes E2E cobrindo fluxos críticos no browser (P3 pendente).

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
