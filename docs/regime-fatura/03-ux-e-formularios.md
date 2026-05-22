# Regime de Fatura — UX e Formulários

## Rotas e Componentes

Nenhuma rota nova. As mudanças são em componentes existentes e novos componentes
inseridos no dashboard e nas configurações.

## Fluxo 1 — Ativação do Regime

**Onde:** `/contas` — página de gerenciamento de contas (`app/(app)/contas/page.tsx`),
em uma `<Section title="Regime de fatura">` **separada**, após a seção de lista de contas.
Não é vinculado a nenhuma conta específica — o regime é global por usuário. Não é
`/configuracao-mes` (que é para overrides de orçamento mensal, não preferências
permanentes do usuário).

**Trigger:** toggle "Regime de fatura" desativado por padrão.

**Ao ativar:**
1. Toggle muda para ativo
2. Aparece seletor de mês "Ativo a partir de:" (padrão: mês atual)
3. Aviso: "A partir deste mês, gastos no crédito não entrarão nas despesas do dashboard
   até que a fatura seja registrada como paga."
4. Botão "Salvar"

**Ao desativar:**
1. Se já houver pagamento de fatura registrado, bloquear a desativação e orientar:
   "Exclua os pagamentos de fatura registrados antes de alterar este modo."
2. Se não houver pagamento registrado, exibir confirmação: "Ao desativar, os meses futuros
   voltam ao modelo padrão. Meses anteriores ao período ativo não são alterados."
3. Confirmar → limpa `faturaActiveFrom`, seta `creditMode = 'accrual'`

**Validação:**
- Ao ativar: pelo menos uma conta de crédito com `closingDay > 1` configurado deve existir;
  caso contrário exibir aviso inline: "Configure o dia de fechamento em pelo menos um
  cartão de crédito antes de ativar este modo." (`closingDay = 1` não é suficiente —
  `billingCycleDateRange` retorna `null` para esse valor.)

## Fluxo 2 — Card de Fatura no Dashboard

**Onde:** dashboard, abaixo dos cards de resumo, um card por conta de crédito com
`closingDay > 1` e regime ativo.

### Estados do Card

**Estado: ciclo aberto (em andamento)**
```
Nubank
Ciclo 20/04 – 19/05          R$ 847,00
Vence após 19/05
```
Sem botão de ação — ciclo ainda não fechou.

**Estado: ciclo fechado sem pagamento (alerta)**
```
⚠ Nubank
Ciclo 20/04 – 19/05          R$ 847,00
Vence em breve · não pago
                    [Registrar pagamento]
```
Card com borda/cor de `warning`. Botão primário visível.

**Estado: pago**
```
Nubank
Ciclo 20/04 – 19/05          R$ 847,00
Pago em 20/05
```
Card neutro, sem botão.

**Comportamento:**
- Mostrar somente o ciclo mais recente (aberto ou o último fechado)
- Se houver ciclo fechado não pago E ciclo aberto em andamento: mostrar o fechado
  não pago (estado de alerta tem prioridade)
- Depois que o ciclo fechado for pago, o card pode mostrar o estado "pago" daquele ciclo
  como confirmação; ao avançar para o próximo ciclo relevante, volta ao estado aberto.
- Múltiplas contas de crédito = múltiplos cards

## Fluxo 3 — Registrar Pagamento de Fatura

**Trigger:** botão "Registrar pagamento" no card de fatura.

**Componente:** `FaturaPaymentDialog` — dialog desktop + drawer mobile (padrão responsivo
do projeto, ver `DeleteButton` e `InvestmentEntryDialog` como referência).

**Campos do formulário:**

| Campo | Tipo | Pré-preenchido | Editável |
| ----- | ---- | -------------- | -------- |
| Cartão (conta de crédito) | texto exibido | sim — nome do cartão | não |
| Ciclo de referência | texto exibido | sim — `MM/AAAA` do ciclo | não |
| Valor da fatura | valor | sim — soma das transações e gastos fixos de crédito do ciclo | não |
| Conta de débito | `Select` | não | sim |
| Data do pagamento | date input | sim — hoje | sim |

**Validações:**
- Conta de débito: obrigatória, deve ser `type = 'debit'` ou `'pix'`
- Data: obrigatória, deve ser `>= primeiro dia após o fim do ciclo` (`cycleEnd + 1`).
  Para ciclo 20/04–19/05, a primeira data válida é 20/05.
- Valor: exibido somente leitura (não editável — sem pagamento parcial)

**Ao confirmar:**
- Cria transação com `accountId = contaDeDebito`, `amount = totalCiclo`,
  `categoryId = null`, `faturaAccountId = contaCredito.id`, `faturaCycleMonth = ciclo`,
  `referenceMonth = mês da data de pagamento`
- Fecha dialog
- Revalida `/dashboard`

**Estado de carregamento:** botão "Registrar" com spinner; campos desabilitados.

**Erro:** toast de erro; dialog permanece aberto (nunca fechar no catch).

## Padrão de Lista de Transações

Transações em contas de crédito continuam aparecendo normalmente na lista de transações
individuais (ex: em `/registro` e no drill-down do card de fatura futuro).

A transação de pagamento de fatura aparece na lista como qualquer outra saída, com
descrição gerada automaticamente: `"Fatura {nome do cartão} – {MMM/AAAA}"`.

Ela aparece sem categoria. Para evitar quebrar a regra `categoryId = null`, o botão de
edição comum (`TransactionEditDialog`) deve ser ocultado para transações com
`faturaAccountId IS NOT NULL`. Na v1, correção de erro é feita deletando o pagamento e
registrando novamente.

## Configuração de Conta — Pré-requisito

O `closingDay` já existe em `paymentAccounts`. Se uma conta de crédito não tiver
`closingDay > 1`, o card de fatura não é exibido para ela e um aviso na tela de
configuração de conta orienta o usuário a preencher um valor válido.

## Interação com `?cycleAccount` Filter

O dashboard já suporta um seletor de ciclo (`?cycleAccount=<uuid>`) que bifurca para
`getDashboardDataBillingCycle`. **Decisão para v1:** quando `?cycleAccount` está presente,
o filtro de ciclo prevalece e o regime de fatura é ignorado naquela visualização — o
usuário está consultando o ciclo de uma conta específica, não o resumo mensal do caixa.
Os cards de fatura são ocultados quando `?cycleAccount` está ativo.

## Deleção de Pagamento de Fatura

Uma transação de pagamento de fatura pode ser deletada via `/registro` como qualquer
outra transação. O card volta automaticamente ao estado "fechado sem pagamento" porque
o estado é derivado do banco em tempo real. Não há validação especial de UI — o
comportamento é intencional (permite corrigir erros de registro).

## Questões Abertas de UX

| # | Questão | Recomendação |
| - | ------- | ------------ |
| 1 | Exibir data de vencimento exata no card? | V1 exibe "após DD/MM" usando a data de fim do ciclo (`cycleEnd` de `billingCycleDateRange`) — sem `dueDay` |
| 2 | Card de fatura fica no dashboard principal ou numa seção separada? | Dashboard principal, após os summary cards — visibilidade imediata |
| 3 | Mostrar histórico de faturas pagas? | Não na v1 — futura tela de detalhe da conta |
