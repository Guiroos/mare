# Implementação de Testes — Histórico

Este arquivo foi substituído pela documentação modular em `docs/testing/`.

A fonte canônica agora é:

- [README.md](./README.md) — índice e resumo executivo;
- [01-contexto-e-escopo.md](./01-contexto-e-escopo.md) — objetivo, camadas e
  estado atual;
- [02-arquitetura-e-integracoes.md](./02-arquitetura-e-integracoes.md) —
  pacotes, configs e integrações;
- [03-achados-criticos.md](./03-achados-criticos.md) — análise crítica, code
  smells e riscos;
- [04-roadmap-melhoria-continua.md](./04-roadmap-melhoria-continua.md) —
  próximos passos priorizados;
- [05-referencia-operacional.md](./05-referencia-operacional.md) — padrões para
  escrever e rodar testes.

## Motivo da substituição

A versão anterior misturava plano de implantação, checklist, decisões técnicas e
estado atual da cobertura. Isso dificultava manutenção e deixava algumas partes
defasadas em relação ao repo.

Os pontos críticos da última revisão foram incorporados nos arquivos novos:

- divergência entre schema, docs e action em `deleteInstallmentGroup`;
- necessidade de preflight obrigatório para variáveis Neon;
- coverage unitário enganoso para `actions` e `queries`;
- lacunas de auth/ownership nos testes de actions;
- risco de testes replicarem lógica de action;
- fragilidade do padrão de dynamic import;
- ausência de CI para integração;
- Playwright ainda pendente.
