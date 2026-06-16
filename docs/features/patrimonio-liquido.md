# Patrimônio Líquido (Net Worth)

## Problema / Contexto

O Maré rastreia renda, despesas e investimentos por mês, mas não há uma visão agregada de quanto o usuário vale hoje — o patrimônio líquido (ativos − passivos). YNAB trata o Net Worth como um dos seus 5 relatórios mais importantes. Usuários com investimentos e múltiplas contas sentem falta dessa visão consolidada.

## O que já temos

- `getPatrimonyTimeline` em `lib/queries/investments.ts` — já calcula patrimônio de investimentos mês a mês
- Saldos de contas: não há tabela de saldo bancário (o Maré não rastreia saldo de conta corrente, só transações)
- Metas com progresso via `getGoalsWithProgress`
- Investimentos com saldo calculado em JS

## MVP — como fazer

**Página `/patrimonio`** com três seções:

**1. Investimentos (já existe):** valor total por tipo de investimento, soma geral. Reutilizar dados de `getPatrimonyTimeline`.

**2. Metas financeiras:** progresso das metas como "ativos com destino". Reutilizar `getGoalsWithProgress`.

**3. Evolução mensal:** gráfico de linha com o patrimônio de investimentos nos últimos 12 meses — `getPatrimonyTimeline` já retorna isso.

**Total no hero:** `sum(investment balances)` como patrimônio atual, sem tentar rastrear saldo bancário (que exigiria entrada manual de saldo).

> Nota: o Maré não rastreia saldo de conta corrente — o patrimônio MVP é o patrimônio investido, não o patrimônio total. Isso é honesto e utilizável.

## Fora do MVP

- Saldo manual de contas bancárias (campo "saldo atual" em `paymentAccounts`)
- Passivos: financiamento imobiliário, empréstimos
- Patrimônio líquido real (ativos − passivos)
- Comparação com benchmark (CDI, IPCA)
