# Testing — Roadmap de Melhoria Contínua

## P0 — Alinhar Contratos Críticos

### 1. Decidir `deleteInstallmentGroup`

Objetivo: eliminar a divergência entre schema, action, testes e docs.

Critérios de aceite:

- decisão registrada neste diretório;
- `lib/actions/transactions.ts` reflete a decisão;
- teste de schema e teste de action usam expectativas compatíveis;
- texto antigo sobre transações órfãs não contradiz a action real.

### 2. Adicionar preflight Neon

Objetivo: falhar cedo quando o ambiente de integração não estiver seguro.

Critérios de aceite:

- `NEON_API_KEY`, `NEON_PROJECT_ID` e `NEON_PARENT_BRANCH_ID` são obrigatórios;
- mensagem de erro explica qual variável falta;
- `NEON_PARENT_BRANCH_ID` continua apontando para branch dev;
- `npm run test:integration` não inicia se o ambiente estiver incompleto.

### 3. Criar CI de pull request

Objetivo: transformar a suíte de integração em barreira automatizada.

Critérios de aceite:

- `.github/workflows/ci.yml` existe;
- workflow roda em `pull_request`;
- comandos: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run test:integration`;
- secrets Neon configurados no GitHub;
- integração segue fora do pre-push.

## P1 — Cobrir Camada de Aplicação

### 4. Fortalecer `actions-debtors.test.ts`

Critérios de aceite:

- pelo menos um caso de ownership rejeitado por action crítica;
- pelo menos um caso de usuário não autenticado;
- asserts de ownership verificados com IDs esperados;
- inputs inválidos rejeitados sem escrita no banco.

### 5. Criar `actions-transactions.test.ts`

Prioridade:

1. `createInstallmentPurchase` cria grupo e N transações com nomes, valores,
   datas e `referenceMonth` corretos.
2. `createInstallmentPurchase` rejeita categoria ou conta sem ownership.
3. `deleteInstallmentGroup` cobre a semântica decidida no P0.

Critérios de aceite:

- action real é importada dinamicamente;
- não há reimplementação local da regra;
- banco é verificado após cada action.

### 6. Criar `queries-dashboard.test.ts`

Prioridade:

1. `getDashboardData` soma apenas dados do `userId` correto.
2. `getDashboardData` soma apenas o `referenceMonth` correto.
3. `getCategoryGroupProgress` respeita orçamento padrão e override mensal.
4. Cenário com outro usuário não contamina totais.

Critérios de aceite:

- fixtures incluem pelo menos dois usuários;
- dados de meses diferentes coexistem no mesmo branch;
- assertions validam agregações e listas retornadas.

## P2 — Melhorar Arquitetura de Testes

### 7. Separar coverage unitário e integração

Opções:

- restringir `test:coverage` a unitários reais; ou
- criar `test:coverage:unit` e `test:coverage:integration`.

Critérios de aceite:

- relatório global não acusa `actions`/`queries` como zero por erro de escopo;
- thresholds só entram quando o relatório estiver confiável;
- README explica qual comando usar em cada situação.

### 8. Reduzir fragilidade de imports dinâmicos

Objetivo: diminuir a chance de conectar ao banco errado.

Possíveis caminhos:

- `getDb()` lazy em `lib/db`;
- factory de DB para testes;
- módulo de actions parametrizável apenas na camada interna;
- lint/regra documental proibindo import estático de action em integração.

Critérios de aceite:

- testes de action continuam usando banco Neon;
- padrão fica mais difícil de quebrar acidentalmente;
- `.claude/testing.md` e `05-referencia-operacional.md` são atualizados.

## P3 — E2E Enxuto

### 9. Adicionar Playwright

Critérios de aceite:

- `@playwright/test` instalado;
- `playwright.config.ts` criado;
- `__tests__/e2e/` criado;
- primeiro teste cobre redirect de rota autenticada para login.

### 10. Cobrir fluxos críticos

Ordem sugerida:

1. Login/redirect.
2. Registro de despesa aparecendo no dashboard.
3. Fluxo de devedores: pessoa, cobrança e quitação.

Critérios de aceite:

- OAuth real não é dependência obrigatória;
- dados de teste são isolados;
- suite roda localmente e pode ser adicionada ao CI depois.

## Checklist Atual

| Item | Status |
| ---- | ------ |
| Unitários básicos | concluído |
| Integração de schema | concluído |
| Actions de devedores | parcial |
| Actions de transações | pendente |
| Queries de dashboard | pendente |
| Preflight Neon | pendente |
| CI com integração | pendente |
| Coverage confiável | pendente |
| Playwright | pendente |
