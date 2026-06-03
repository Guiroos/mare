# Tech Spec: Bugs de Cálculo no Panorama Anual

> **Status: implementado** (junho/2026)

## Contexto

Durante análise dos dados de produção do usuário `31b50514-...` em junho/2026, foram
identificados três problemas no panorama anual. O primeiro foi documentado separadamente
em `docs/investimentos/08-retorno-capital-panorama.md` (retorno de capital inflando
receita). Este documento cobre os outros dois, que são bugs de lógica na camada de
apresentação independentes de mudança de schema.

---

## Bug 1 — Dois valores de "saldo" divergentes na mesma tela

### Descrição

`page.tsx` e `AnnualSummaryCards` calculavam o saldo do ano de formas diferentes. No ano
corrente, quando há despesas fixas registradas em meses futuros, os dois valores não
coincidiam — e ambos apareciam na mesma tela simultaneamente.

### Raiz do problema

Em `app/(app)/panorama/page.tsx` (antes do fix):

```ts
// Soma os 12 meses — inclui meses futuros
const totalExpenses = overview.reduce((sum, m) => sum + m.totalExpenses, 0)
const finalBalance = totalIncomes - totalExpenses - totalInvested
```

`finalBalance` era usado no `<tfoot>` da tabela mensal (coluna "Saldo").

Em `components/panorama/AnnualSummaryCards.tsx` (não mudou):

```ts
// Filtra só meses <= hoje
const active = overview.filter((m) => m.month <= nowYearMonth)
const totalExpensesYTD = active.reduce((s, m) => s + m.totalExpenses, 0)
const balance = totalIncomes - totalExpensesYTD - totalInvested
```

Despesas fixas recorrentes (aluguel, assinatura, mensalidade) existem em meses futuros
no banco — cada entrada de `fixedExpenses` tem um `referenceMonth`. Com Jul–Dez tendo
despesas fixas, `totalExpenses` (12 meses) era maior que `totalExpensesYTD` (Jan–Jun),
produzindo `finalBalance` < `balance`.

### Correção aplicada

Em `app/(app)/panorama/page.tsx`:

```ts
const nowYM = currentYearMonth()
const activeOverview = overview.filter((m) => m.month <= nowYM)

const totalIncomes = overview.reduce((sum, m) => sum + m.totalIncomes, 0)
const totalExpensesYTD = activeOverview.reduce((sum, m) => sum + m.totalExpenses, 0)
const totalInvested = overview.reduce((sum, m) => sum + m.totalInvested, 0)
const finalBalance = totalIncomes - totalExpensesYTD - totalInvested
```

O rodapé da tabela (desktop e mobile) usa `totalExpensesYTD`. Para anos passados,
`activeOverview` = todos os 12 meses — comportamento inalterado.

---

## Bug 2 — `bestMonth`/`worstMonth` contaminados pelo ciclo de reinvestimento

### Descrição

O `PatrimonyEvolutionChart` determinava "melhor mês" e "pior mês" pelo campo `balance`
de cada `OverviewMonth`. Com o income do resgate inflado pelo capital retornado, maio
aparecia como melhor mês por volume de receita, mesmo que o caixa real do usuário não
tivesse mudado significativamente.

### Resolução

Resolvido automaticamente pela correção do `investment_return_capital` (doc 08). Não
exigiu implementação adicional além daquela spec.

---

## Relação entre os bugs e o doc 08

Os três problemas do panorama se resolveram em cascata:

```
investment_return_capital (doc 08)
    └── corrige totalIncomes por mês em getAnnualOverview
          ├── corrige projectedIncome
          ├── corrige taxaPoupanca
          ├── corrige taxaInvestimento (% da receita)
          ├── corrige incomeChangePct vs. ano anterior
          └── corrige bestMonth/worstMonth (Bug 2 deste doc)

finalBalance da tabela vs. card (Bug 1 deste doc)
    └── correção independente — não depende do doc 08
```

A correcao do `totalIncomes` tambem foi aplicada em `getDashboardData` e
`getMonthlyEvolution` (ambos em `lib/queries/dashboard.ts`) para manter consistencia
entre panorama e dashboard. A spec original dizia "nao alterar o dashboard", mas a
inconsistencia era visivel: o lado de investimentos ja filtrava `excludeFromCashFlow`,
enquanto o income ainda incluia o capital — produzindo saldo do mes inflado no dashboard.
