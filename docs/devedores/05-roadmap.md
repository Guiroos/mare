# Devedores — Roadmap

## Status Por Fase

| Fase | Objetivo                     | Status    |
| ---- | ---------------------------- | --------- |
| 1    | Banco e tipos                | concluída |
| 2    | Validações, queries e actions| concluída |
| 3    | Página e cadastro de pessoas | concluída |
| 4    | Cobranças manuais            | concluída |
| 5    | Pagamentos                   | concluída |
| 6    | Vínculo com transações       | concluída |
| 7    | Ajustes e exclusão segura    | concluída |

---

## Fase 1 — Banco e Tipos

**Objetivo:** criar base persistente do recurso.

Passos:

- [x] Adicionar tabelas `people` e `debtor_entries` em `lib/db/schema.ts`
- [x] Adicionar índices: `debtor_entries_user_person_idx`, `debtor_entries_user_month_idx`
- [x] Adicionar relações Drizzle
- [x] Rodar `npm run db:generate` → `0008_lying_payback.sql`
- [x] Formatar migrations: `npx prettier --write lib/db/migrations/meta/`
- [x] Rodar `npx tsc --noEmit` — passou sem erros

Critério de aceite:

- Schema compila sem erro de typecheck.
- Migration gerada e formatada.

---

## Fase 2 — Validações, Queries e Actions

**Objetivo:** criar API interna server-side do domínio.

Passos:

- [x] Criar `lib/validations/debtors.ts` (`personSchema`, `debtChargeSchema`, `debtPaymentSchema` — sem `debtAdjustmentSchema`)
- [x] Criar `lib/queries/debtors.ts`
- [x] Criar `lib/actions/debtors.ts`
- [x] Adicionar `assertOwnsPerson` e `assertOwnsDebtEntry` em `lib/auth/ownership.ts`
- [x] Usar `assertOwnsPerson` em toda action que recebe `personId`
- [x] Usar `assertOwnsDebtEntry` em toda action que edita ou exclui um lançamento
- [x] Revalidar `/devedores` em mutações de pessoa
- [x] Revalidar `/devedores` e `/devedores/[id]` em mutações de lançamento
- [x] Revalidar `/dashboard` e `/panorama` quando pagamento gerar `income`
- [x] Rodar `npm run build:check`

Critério de aceite:

- Actions não permitem acessar dados de outro usuário.
- Saldo calculado corretamente (`charge - payment + adjustment`).
- Pagamento pode ou não criar entrada conforme flag do caller.

---

## Fase 3 — Página e CRUD de Pessoas

**Objetivo:** permitir listar, cadastrar, editar, arquivar e excluir pessoas.

Passos:

- [x] Criar `app/(app)/devedores/page.tsx`
- [x] Criar `app/(app)/devedores/loading.tsx`
- [x] Criar `app/(app)/devedores/[id]/page.tsx`
- [x] Criar `app/(app)/devedores/[id]/loading.tsx`
- [x] Criar `components/devedores/PersonDialog.tsx` (criar + editar)
- [x] Criar `components/devedores/DebtorList.tsx`
- [x] Criar estado vazio na lista
- [x] Adicionar `/devedores` no `Sidebar`
- [x] Adicionar `/devedores` no `BottomNav`
- [x] Implementar `archivePerson` com aviso de saldo em aberto (quando `saldo > 0`)
- [x] Implementar `deletePersonIfEmpty` (apaga apenas se não houver lançamentos)
- [x] Rodar `npm run lint && npm run build:check`

Critério de aceite:

- Usuário consegue criar, editar e arquivar pessoa.
- Pessoa sem lançamentos pode ser excluída definitivamente.
- Pessoa arquivada some da lista principal.
- Nome clicável na lista navega para `/devedores/[id]`.
- Rota aparece na navegação desktop e mobile.

---

## Fase 4 — Cobranças Manuais

**Objetivo:** permitir registrar e excluir valores que uma pessoa deve sem transação de origem.

Passos:

- [x] Criar `components/devedores/DebtChargeDialog.tsx`
- [x] Criar `components/devedores/DebtorSummaryCards.tsx`
- [x] Mostrar saldo por pessoa na lista
- [x] Mostrar total em aberto nos cards de resumo
- [x] Criar `components/devedores/DebtEntryList.tsx` com exclusão de lançamento simples
- [x] Mostrar histórico de lançamentos em `/devedores/[id]`
- [x] Implementar exclusão de `charge` sem `sourceTransactionId` via `DeleteButton`
- [x] Rodar `npm run lint && npm run build:check`

Critério de aceite:

- Cobrança aumenta saldo da pessoa.
- Total em aberto reflete a cobrança.
- Histórico mostra o lançamento.
- Usuário consegue excluir uma cobrança simples; saldo é recalculado.

---

## Fase 5 — Pagamentos

**Objetivo:** permitir registrar e excluir pagamento simples, e reduzir saldo.

Passos:

- [x] Criar `components/devedores/DebtPaymentDialog.tsx`
- [x] Implementar checkbox `Registrar também como entrada` (marcado por padrão)
- [x] Se marcado, criar `income` vinculado e salvar `incomeId`
- [x] Mostrar pagamento no histórico
- [x] Atualizar saldo da pessoa
- [x] Implementar exclusão de `payment` sem `incomeId` via `DeleteButton`
- [x] Rodar `npm run lint && npm run build:check`

Critério de aceite:

- Pagamento reduz saldo.
- Pagamento com entrada aparece no dashboard como entrada.
- Pagamento sem entrada altera apenas o módulo de devedores.
- Usuário consegue excluir um pagamento simples (sem income vinculado); saldo é recalculado.

---

## Fase 6 — Vínculo Com Transações

**Objetivo:** permitir criar dívida a partir de uma transação existente.

Passos:

- [x] Criar query `getTransactionsForDebtLink`
- [x] Criar action `createDebtChargeFromTransaction`
- [x] Adicionar campo `Select` de transação de origem dentro do `DebtChargeDialog` (sem componente separado)
- [x] Salvar `sourceTransactionId`
- [x] Mostrar transação vinculada no histórico
- [x] Exibir aviso se valor atribuído for maior que o da transação
- [x] Rodar `npm run lint && npm run build:check`

Critério de aceite:

- Usuário consegue vincular cobrança a uma transação.
- Transação original não muda.
- Histórico mostra origem da cobrança.

---

## Fase 7 — Exclusão Com Dependências e Ajustes

**Objetivo:** tratar remoções que têm consequências em outros módulos.

Passos:

- [x] Se `payment` tem `incomeId`, exibir confirmação com opção de excluir também a entrada vinculada
- [x] Passar flag `alsoDeleteIncome` para `deleteDebtEntry` conforme escolha do usuário
- [ ] Adicionar ajuste manual de saldo se houver caso de uso concreto
- [x] Rodar `npm run lint`, `npm run build:check` e `npm run build`

Critério de aceite:

- Ao excluir pagamento com income vinculado, usuário escolhe se exclui também a entrada.
- Histórico financeiro não é perdido sem confirmação clara.

---

## Questões Abertas

| # | Questão                                                                  | Recomendação                              | Status  |
| - | ------------------------------------------------------------------------ | ----------------------------------------- | ------- |
| 1 | Ao excluir pagamento com `incomeId`, excluir também a entrada vinculada? | Sim, via flag `alsoDeleteIncome` na action e confirmação na UI | resolvida |
| 2 | Pessoa com histórico pode ser apagada?                                   | Não; `deletePersonIfEmpty` só apaga sem lançamentos; demais casos usam `archivePerson` | resolvida |
| 3 | Cobranças devem ter vencimento obrigatório?                              | Não na primeira versão — `dueDate` é opcional | resolvida |
| 4 | Tela deve ter rota dinâmica `/devedores/[id]`?                           | Sim, desde a v1. Acessada via nome clicável na lista. | resolvida |
| 5 | Devedores devem aparecer no dashboard?                                   | Não, exceto pagamentos que virarem `income` | resolvida |

---

## Backlog e Limitações

### Pendências deferidas (dentro do escopo v1, aguardam caso de uso)

| # | Item | Estado no banco | Por quê foi adiado |
| - | ---- | --------------- | ------------------ |
| A | Ajuste manual de saldo | Tipo `adjustment` existe em `debtor_entries`; sem UI, `debtAdjustmentSchema` ou action | Nenhum caso de uso concreto identificado |
| B | Vencimento de cobrança (`dueDate`) | Campo existe em `debtor_entries` | Campo reservado; card de "valores vencidos" entra quando usado na prática |

### Limitações conhecidas (by design, aceitas na v1)

| # | Limitação | Detalhe |
| - | --------- | ------- |
| C | Cobranças com `sourceTransactionId` não podem ser excluídas | `DebtEntryList` não exibe botão de exclusão para esse caso; não há ação de desvínculo; para corrigir um vínculo errado, o usuário precisa criar uma nova cobrança |
| D | Exclusão de `income` fora de devedores não avisa | Deletar a entrada em `/registro` ou dashboard faz o banco aplicar `onDelete: set null`; o `payment` fica com `incomeId = null` sem notificação — saldo do devedor não é afetado |

### Backlog pós-v1

| # | Item | Detalhe |
| - | ---- | ------- |
| E | Dashboard completa de `/devedores/[id]` | Planejada em `06-planejamento-detalhe-pessoa.md`: resumo financeiro, evolução do saldo, histórico agrupado e filtros |
| F | Ação "Atribuir a devedor" em `/registro` | Atalho para criar cobrança diretamente da lista de transações, sem navegar para devedores |

---

## Inventário de Arquivos

### Criados

| Arquivo                                              |
| ---------------------------------------------------- |
| `app/(app)/devedores/page.tsx`                       |
| `app/(app)/devedores/loading.tsx`                    |
| `app/(app)/devedores/[id]/page.tsx`                  |
| `app/(app)/devedores/[id]/loading.tsx`               |
| `components/devedores/PersonDialog.tsx`              |
| `components/devedores/DebtChargeDialog.tsx`          |
| `components/devedores/DebtPaymentDialog.tsx`         |
| `components/devedores/DebtorSummaryCards.tsx`        |
| `components/devedores/DebtorList.tsx`                |
| `components/devedores/DebtEntryList.tsx`             |
| `lib/queries/debtors.ts`                             |
| `lib/actions/debtors.ts`                             |
| `lib/validations/debtors.ts`                         |

### Alterados

| Arquivo                            |
| ---------------------------------- |
| `lib/db/schema.ts`                 |
| `lib/auth/ownership.ts`            |
| `components/layout/Sidebar.tsx`    |
| `components/layout/BottomNav.tsx`  |
