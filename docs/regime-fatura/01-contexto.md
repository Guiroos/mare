# Regime de Fatura — Contexto e Decisões

## Contexto

O Maré hoje usa um modelo de **competência** para crédito: uma transação no cartão de
crédito entra como despesa no mês em que a compra foi feita, independentemente de quando
a fatura será paga. Isso funciona bem para um perfil de usuário, mas conflita com o modelo
mental de outro perfil.

Foram identificados dois perfis distintos:

**Perfil A — Competência (modelo atual)**
O usuário recebe o salário e considera que aquilo cobre os gastos do mês corrente, mesmo
que a fatura do cartão só vença no mês seguinte. A despesa "pertence" ao mês do gasto.

**Perfil B — Caixa / Fatura**
O usuário paga a fatura com o recebimento do mês seguinte. Para ele, o gasto só é "real"
quando a fatura é paga. O dashboard no modelo atual aparece "inflado" com despesas que
ele ainda não pagou e que só sairão da conta no vencimento.

Dois usuários reportaram esse problema. Em ambos os casos, a raiz é a mesma: o crédito
cria uma despesa comprometida que ainda não saiu do caixa, e a visão do mês reflete um
saldo pior do que o usuário sente que tem.

## Decisão Arquitetural Principal

Implementar **regime de fatura** como uma configuração opt-in por usuário, não como
comportamento padrão.

Quando ativado:
- Transações em contas de crédito NÃO entram no cálculo de despesas do mês
- Gastos fixos em contas de crédito também NÃO entram diretamente no cálculo de despesas
  do mês; entram no total da fatura do ciclo correspondente
- A despesa entra somente quando o usuário registra o **pagamento da fatura**
- O pagamento da fatura é uma transação de saída na conta corrente/débito, vinculada
  ao ciclo do cartão de crédito correspondente
- As compras individuais continuam armazenadas e visíveis para rastreabilidade

Quando não ativado (padrão):
- Comportamento atual inalterado — zero impacto nos usuários existentes

## Decisões Tomadas

| Decisão | Escolha | Motivo |
| ------- | ------- | ------ |
| Granularidade da configuração | Por usuário (global) | Regime de fatura é uma filosofia financeira pessoal, não uma preferência por cartão |
| Pagamento parcial | Não permitido | Complexidade alta, nenhum caso de uso identificado na v1 |
| Troca de regime | Ativação com "a partir de mês X" | Evita recálculo retroativo de meses já fechados |
| Contas afetadas | Todas com `type = 'credit'` | Coerente com a decisão por-usuário |
| Pré-requisito | Conta de crédito precisa ter `closingDay > 1` | Mesmo critério de `getCreditAccounts`; `closingDay <= 1` não gera ciclo |
| Alteração após pagamentos | Bloqueada na v1 | Evita duplicidade ou buracos em meses já materializados por pagamento de fatura |

## Objetivo

Permitir que o usuário:

- ative o regime de fatura a partir de um mês escolhido
- veja no dashboard o total acumulado em cada cartão no ciclo atual
- receba alerta visual quando há fatura fechada sem pagamento registrado
- registre o pagamento de uma fatura, vinculando-o ao ciclo correspondente
- tenha o saldo do mês refletindo somente o que efetivamente saiu do caixa

## Interação com o Filtro de Ciclo Existente (`?cycleAccount`)

O dashboard já tem um seletor de ciclo que filtra por conta via `?cycleAccount=<uuid>`,
usando `getDashboardDataBillingCycle`. Quando esse filtro está ativo, o usuário está
consultando o ciclo de uma conta específica — não o resumo mensal do caixa.

**Decisão para v1:** `?cycleAccount` prevalece sobre o regime de fatura naquela
visualização. Quando `cycleAccount` está ativo, os cards de fatura são ocultados e o
cálculo de despesas segue a lógica de ciclo (`getDashboardDataBillingCycle`), sem
bifurcação de regime. São dois modos de leitura distintos do mesmo mês.

## Não Objetivos Da Primeira Versão

- Não permitir pagamento parcial de fatura
- Não criar fatura automaticamente no fechamento do ciclo
- Não enviar notificação de vencimento
- Não detalhar breakdown de categorias dentro do pagamento de fatura
- Não sincronizar com banco ou operadora
- Não migrar retroativamente meses anteriores ao `faturaActiveFrom`
- Não implementar regime de fatura por conta individual

## Impacto Em Relatórios

### Dashboard

Meses `>= faturaActiveFrom` com regime ativo:
- Despesas: excluem compras em contas de crédito; incluem pagamentos de fatura porque eles
  são gravados na conta de origem débito/pix
- Gastos fixos em contas de crédito: excluídos do mês direto e incluídos no total da fatura
- Saldo: reflete caixa real (apenas o que saiu da conta corrente/débito)
- Adicionado: card de fatura por conta de crédito com `closingDay > 1`

Meses `< faturaActiveFrom`:
- Comportamento atual inalterado

### Panorama Anual

Mesma bifurcação por `faturaActiveFrom` — meses anteriores à ativação usam accrual.

### Orçamento Por Categoria

Fatura como pagamento único não tem `categoryId` — breakdown por categoria dentro de um
pagamento de fatura não existe na v1. Usuários em regime de fatura perdem visibilidade
de categoria para gastos de crédito nesses meses.

Decisão de schema: `transactions.categoryId` passa a aceitar `null` somente para
pagamentos de fatura (`faturaAccountId IS NOT NULL`). Transações normais continuam
obrigadas a ter categoria pelas validações atuais.
