# Regime de Fatura — Roadmap

## Status Por Fase

| Fase | Objetivo                          | Status       |
| ---- | --------------------------------- | ------------ |
| 1    | Schema e configuração             | concluída    |
| 2    | Queries de estado de fatura       | concluída    |
| 3    | Cards de fatura no dashboard      | concluída    |
| 4    | Fluxo de pagamento de fatura      | concluída    |
| 5    | Bifurcação das queries de despesa | concluída    |
| 6    | Polish e edge cases               | em progresso |

---

## Fase 1 — Schema e Configuração

**Objetivo:** criar a base de dados e permitir ativar/desativar o regime.

Passos:

- [x] Criar tabela `user_settings` em `lib/db/schema.ts` com `creditMode` e `faturaActiveFrom`
- [x] Adicionar `faturaAccountId` e `faturaCycleMonth` em `transactions` no schema
- [x] Tornar `transactions.categoryId` nullable no schema, mantendo obrigatório nas
      validações de transações normais
- [x] Adicionar `transactions_fatura_unique_idx` no schema Drizzle com
      `uniqueIndex(...).where(sql\`${t.faturaAccountId} IS NOT NULL\`)`
- [x] Rodar `npm run db:generate`
- [x] Editar manualmente a migration gerada: remover `NOT NULL` de `transactions.category_id`
      e adicionar check constraints para permitir `categoryId = null` somente em pagamento de
      fatura e manter `creditMode` coerente com `faturaActiveFrom`
- [x] Formatar migration: `npx prettier --write lib/db/migrations/meta/`
- [x] Criar `lib/validations/settings.ts` com `creditModeSchema`
- [x] Criar `lib/actions/fatura.ts` com `updateCreditMode`
- [x] Implementar validação em `updateCreditMode`: bloquear qualquer alteração de
      `creditMode`/`faturaActiveFrom` se já houver pagamento de fatura registrado
- [x] Criar UI de toggle + seletor de mês em `/contas` (`app/(app)/contas/page.tsx`),
      numa `<Section title="Regime de fatura">` separada (configuração global, não por conta)
- [x] Rodar `npm run lint && npm run typecheck`

Critério de aceite:

- Schema compila sem erro.
- `transactions.categoryId` aceita `null` apenas para pagamento de fatura; transações
  normais seguem exigindo categoria.
- Usuário consegue ativar e desativar o regime via UI.
- Ativação sem conta de crédito com `closingDay > 1` exibe aviso e bloqueia.
- `faturaActiveFrom` é obrigatório ao ativar; zerado ao desativar.
- Tentar alterar `creditMode` ou `faturaActiveFrom` após registrar pagamento de fatura é rejeitado.

---

## Fase 2 — Queries de Estado de Fatura

**Objetivo:** implementar a leitura do estado de cada ciclo de faturamento.

Passos:

- [x] Criar `lib/queries/fatura.ts`
- [x] Implementar `getUserCreditMode(userId)`
- [x] Implementar `getFaturaState(userId, accountId, referenceMonth)`
- [x] Implementar `getOpenFaturas(userId)`
- [x] Verificar que `billingCycleDateRange` cobre os casos necessários; ajustar se preciso
- [x] Rodar `npm run typecheck`

Critério de aceite:

- `getOpenFaturas` retorna estado correto para ciclo aberto, fechado não pago e pago.
- `getFaturaState` com ciclo sem pagamento retorna `payment: null`.
- `getFaturaState` com pagamento registrado retorna dados do pagamento.
- `getFaturaState` inclui gastos fixos de crédito no total da fatura, além das transações.

---

## Fase 3 — Cards de Fatura no Dashboard

**Objetivo:** exibir visibilidade do ciclo atual para usuários em regime de fatura.

Passos:

- [x] Criar `components/fatura/FaturaCard.tsx`
- [x] Implementar os três estados: ciclo aberto, ciclo fechado sem pagamento (alerta), pago
- [x] Integrar ao `app/(app)/dashboard/page.tsx` — exibir somente quando `creditMode = 'fatura'`
- [x] Garantir que contas sem `closingDay > 1` não geram card
- [ ] Testar com Playwright: verificar os três estados visuais
- [x] Rodar `npm run lint`

Critério de aceite:

- Card aparece somente com regime ativo e conta com `closingDay > 1`.
- Estado de alerta (ciclo fechado não pago) tem destaque visual claro com `warning`.
- Botão "Registrar pagamento" aparece apenas no estado de alerta.
- Múltiplas contas de crédito geram múltiplos cards.

---

## Fase 4 — Fluxo de Pagamento de Fatura

**Objetivo:** permitir registrar o pagamento de uma fatura.

Passos:

- [x] Criar `lib/validations/fatura.ts` com `faturaPaymentActionSchema`
- [x] Implementar `createFaturaPayment` em `lib/actions/fatura.ts`
- [x] Usar `assertOwnsPaymentAccount` existente em `lib/auth/ownership.ts` (não criar nova)
- [x] Criar `components/fatura/FaturaPaymentDialog.tsx` (dialog desktop + drawer mobile)
- [x] Conectar botão "Registrar pagamento" do `FaturaCard` ao dialog
- [x] Ocultar/bloquear edição genérica de transações com `faturaAccountId IS NOT NULL`;
      na v1, correção é deletar e registrar de novo
- [ ] Testar com Playwright: registrar pagamento e verificar que o ciclo pago deixa de exibir
      ação de pagamento duplicada
- [ ] Testar com Playwright: tentar registrar segundo pagamento para o mesmo ciclo — deve falhar
- [x] Rodar `npm run lint && npm run typecheck`

Critério de aceite:

- Pagamento cria transação com `categoryId = null`, `faturaAccountId` e
  `faturaCycleMonth` corretos.
- Valor pré-preenchido com total do ciclo, incluindo gastos fixos de crédito; não é editável.
- Servidor recalcula o total e rejeita se valor enviado divergir.
- Segundo pagamento para o mesmo ciclo é bloqueado.
- Card não permite registrar novamente o mesmo ciclo após confirmação.
- Dialog fecha somente no caminho feliz; erro exibe toast.

---

## Fase 5 — Bifurcação das Queries de Despesa

**Objetivo:** fazer o dashboard e o panorama refletirem o regime de fatura.

Passos:

- [x] Atualizar `getDashboardData` em `lib/queries/dashboard.ts` filtrando as listas já
      carregadas antes do `reduce` (sem query de soma extra)
- [x] Atualizar `getCategoryGroupProgress` em `lib/queries/dashboard.ts` com filtro SQL
      `accountId NOT IN creditAccountIds` e `isNotNull(transactions.categoryId)`
- [x] Atualizar `getMonthlyEvolution` em `lib/queries/dashboard.ts` (**agregação SQL** —
      INNER JOIN com `paymentAccounts` + condição OR por mês; sem query separada)
- [x] Atualizar `getAnnualOverview` em `lib/queries/panorama.ts` (**agregação SQL** —
      mesmo padrão de `getMonthlyEvolution`)
- [x] Atualizar `getAnnualExpensesByGroup` em `lib/queries/panorama.ts` para ignorar
      `categoryId = null` e excluir contas de crédito nos meses em regime de fatura
- [x] Garantir que meses `< faturaActiveFrom` usam comportamento accrual
- [x] Garantir que usuários sem regime ativo (`creditMode = 'accrual'`) não são afetados
- [x] Garantir que pagamento de fatura não é contado duas vezes no dashboard
- [x] Garantir que gastos fixos no crédito não somem do fluxo: saem do dashboard mensal direto
      e entram no total da fatura
- [x] Ajustar `unpaidFixedCount` para não alertar gastos fixos de crédito em meses de fatura
- [ ] Testar com Playwright: verificar que saldo do mês exclui compras de crédito e inclui pagamento de fatura
- [x] Rodar `npm run lint && npm run typecheck && npm run build`

Critério de aceite:

- Usuário em regime de fatura: mês sem pagamento de fatura não conta despesas de crédito.
- Usuário em regime de fatura: mês com pagamento de fatura conta o valor pago como despesa.
- Usuário sem regime ativo: zero diferença no comportamento.
- Meses anteriores ao `faturaActiveFrom`: comportamento accrual preservado.

---

## Fase 6 — Polish e Edge Cases

**Objetivo:** garantir robustez e boa experiência nos cenários limítrofes.

Passos:

- [x] Exibir aviso ao ativar quando nenhum cartão tiver `closingDay > 1`
- [x] Orientar no card de fatura de contas sem `closingDay > 1` a configurar o campo
- [x] Validar que `creditMode`/`faturaActiveFrom` não podem ser alterados enquanto houver
      pagamento de fatura registrado
- [x] Verificar que ao deletar uma transação de pagamento de fatura via `/registro`, o card
      volta ao estado "fechado sem pagamento" (comportamento automático — sem lógica extra)
- [ ] Testar Playwright completo: ativar regime → acumular ciclo → registrar pagamento → verificar dashboard → deletar pagamento → verificar reversão do card → desativar regime → verificar restauração
- [ ] Rodar `npm run lint && npx prettier --check . && npm run typecheck && npm run build`

Critério de aceite:

- Todos os edge cases documentados em `04-backend.md` são tratados.
- Deleção de pagamento de fatura reverte o estado do card corretamente.
- Build sem erros ou warnings.

---

## Questões Abertas

| # | Questão | Recomendação | Status |
| - | ------- | ------------ | ------ |
| 1 | Exibir data de vencimento exata no card? | Depende de `dueDay`; v1 exibe data de fechamento como referência | aberta |
| 2 | Categoria para pagamento de fatura | `categoryId = null` somente para pagamento de fatura; transações normais continuam obrigatórias | decidida |
| 3 | O que mostrar em relatório de categorias para usuário em regime de fatura? | Exibir nota informativa; sem breakdown de crédito nesses meses — resolvido na v2 com orçamento híbrido | decidida |

---

## Limitações Conhecidas (by design, aceitas na v1)

| Limitação | Detalhe |
| --------- | ------- |
| Sem pagamento parcial | Fatura deve ser paga integralmente |
| Sem categoria no pagamento de fatura | Pagamento é lump sum; breakdown de categorias não está disponível para meses com regime ativo |
| Sem histórico de faturas pagas na UI | Visível apenas como transação normal na lista de transações |
| Troca de `faturaActiveFrom` restrita | Após o primeiro pagamento de fatura, `creditMode` e `faturaActiveFrom` ficam travados até deletar esses pagamentos |

## Backlog Pós-v1

| Item | Detalhe |
| ---- | ------- |
| `dueDay` por conta de crédito | Permitir exibir data de vencimento exata no card de fatura |
| Tela de histórico de faturas | Lista de ciclos pagos e abertos por conta de crédito |
| Breakdown de categorias dentro da fatura | Drill-down do pagamento mostrando as compras individuais por categoria |
| Pagamento parcial | Com rastreamento de saldo devedor do ciclo |
| Orçamento híbrido (v2) | Separar fluxo de caixa de orçamento por categoria: manter exclusão de crédito no saldo/evolução, mas incluir transações de crédito no `getCategoryGroupProgress` pelo `referenceMonth` da compra — usuário vê consumo real por categoria sem distorcer o saldo do mês |

## Inventário de Arquivos

### Criados

| Arquivo |
| ------- |
| `lib/queries/fatura.ts` |
| `lib/actions/fatura.ts` |
| `lib/validations/fatura.ts` |
| `lib/validations/settings.ts` |
| `components/fatura/FaturaCard.tsx` |
| `components/fatura/FaturaPaymentDialog.tsx` |
| `components/fatura/OverdueCycleCard.tsx` |
| `components/contas/CreditModeSection.tsx` |

### Alterados

| Arquivo |
| ------- |
| `lib/db/schema.ts` |
| `lib/queries/dashboard.ts` |
| `lib/queries/panorama.ts` |
| `app/(app)/dashboard/page.tsx` |
| `app/(app)/panorama/page.tsx` |
| `app/(app)/contas/page.tsx` |
