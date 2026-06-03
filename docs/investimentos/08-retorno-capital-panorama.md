# Tech Spec: Separação de Capital e Rendimento no Panorama Anual

> **Status: implementado** (junho/2026)

## Contexto

Quando um investimento de renda fixa vence e o usuario registra o resgate com
`destination = 'income'`, o app cria automaticamente um `income` entry com o valor
liquido recebido. Esse income entrava no `getAnnualOverview` como `totalIncomes`, inflando
a receita do mes.

O problema é semantico: o valor liquido de um resgate é composto de duas partes com
naturezas distintas:

- **Capital retornado** — dinheiro que ja era do usuario, estava alocado no investimento.
  Nao é renda nova. Apareceu na conta porque o prazo venceu, nao porque o usuario ganhou
  algo.
- **Rendimento liquido** — o que o investimento efetivamente gerou, apos o IR. Esse sim é
  renda.

Exemplo concreto detectado em producao (usuario `31b50514-...`, maio/2026):

- Resgate da "Nu Caixinha Turbo 05/2026": R$11.907,31 liquido (R$10.000 capital +
  R$2.311,88 rendimento bruto − R$404,57 IR).
- O panorama 2026 exibia receita acumulada de ~R$44.9k ao inves de ~R$33k organico.
- O pico de maio (R$17.880) incluia R$10.000 de capital que ja havia saido como `totalInvested`
  em 2025 — visivel num ano, o custo no outro.

O `balance` era matematicamente incorreto porque o income inflado nao correspondia ao
lado do investimento (que ja excluia o R$10k via `excludeFromCashFlow`).

## Decisao Arquitetural Principal

Adicionar `investment_return_capital` (decimal, nullable) na tabela `incomes`.

- `NULL` → income ordinario (salario, freelance, devolucao, etc.). Sem mudanca de
  comportamento.
- Valor numerico → income originado de resgate de investimento. O valor representa a
  parcela de capital puro contida no resgate.

O **rendimento** nunca é gravado separadamente — é sempre derivado:

```
rendimento_liquido = amount - investment_return_capital
```

Motivo da escolha:

- Evita join chain (income → withdrawal → investments). O calculo acontece uma unica vez
  no write (ao criar o resgate), nao em cada leitura.
- Sem dependencia circular de FK: `investment_withdrawals.income_id` ja aponta para
  `incomes`; adicionar `incomes.withdrawal_id` criaria ciclo.
- `amount` continua sendo o valor total recebido — o item na lista de entradas continua
  exibindo o valor completo.
- `NULL` é um sentinel natural: queries que nao foram atualizadas continuam funcionando
  sem alteracao de comportamento para incomes ordinarios.

## Modelo De Dados

### Alteracao Em `incomes`

Campo adicionado:

- `investmentReturnCapital`: decimal(12,2), nullable, sem default.

Regras:

- `NULL` para todo income que nao é originado de resgate de investimento.
- Quando preenchido, deve ser `>= 0` e `<= amount` (rendimento nao pode ser negativo).
- `amount` continua sendo o valor liquido total recebido — nao muda.
- O rendimento derivado (`amount - investmentReturnCapital`) representa o ganho real apos IR.

### Migration

```sql
ALTER TABLE "incomes" ADD COLUMN "investment_return_capital" numeric(12, 2);
```

Migration: `lib/db/migrations/0012_high_zemo.sql`

O backfill do registro existente em producao foi aplicado manualmente no Neon console
(ID de usuario nao vai para historico de git):

```sql
UPDATE "incomes"
SET "investment_return_capital" = 10000.00
WHERE id = '<income-id-da-nu-caixinha-turbo>';
```

## Calculo Do Capital No Momento Do Resgate

Em `createWithdrawal` (`lib/actions/investments.ts`), quando `destination === 'income'`,
antes de inserir o income:

```ts
const [capitalRow] = await db
  .select({ total: sum(investments.amount) })
  .from(investments)
  .where(
    and(
      eq(investments.userId, userId),
      eq(investments.investmentTypeId, data.investmentTypeId)
    )
  )

const investmentReturnCapital = String(Number(capitalRow?.total ?? 0))
```

Esse valor é inserido junto com o income. Se o tipo nao tiver aportes registrados
(ex: tipo criado sem historico), o capital sera `0` e o rendimento sera igual ao
`amount` total — comportamento seguro.

## Queries Atualizadas

A correcao foi aplicada em **todas as queries que calculam `totalIncomes`**:

### `getAnnualOverview` (`lib/queries/panorama.ts`)

```sql
SUM(
  CASE
    WHEN investment_return_capital IS NOT NULL
    THEN amount - investment_return_capital
    ELSE amount
  END
) AS total_incomes
```

### `getDashboardData` (`lib/queries/dashboard.ts`) — JS

```ts
const totalIncomes = incomeList.reduce(
  (s, i) =>
    s +
    toAmount(i.amount) -
    (i.investmentReturnCapital ? toAmount(i.investmentReturnCapital) : 0),
  0
)
```

Aplicado nos dois paths: normal e cycle view (fatura).

### `getMonthlyEvolution` (`lib/queries/dashboard.ts`) — SQL

Mesma logica CASE WHEN do panorama, aplicada na query de SUM para o grafico de
evolucao de 6 meses do dashboard.

## Fluxo Correto Para Rolagem De Investimento

Quando o usuario resgata uma caixinha e reinveste em outra, o fluxo correto é:

1. Resgate com `destination = 'income'` → income criado com `investmentReturnCapital`
   preenchido com o capital aportado no tipo.
2. Novo aporte com **"ja tinha o valor"** ativado (`excludeFromCashFlow = true`) →
   o capital reciclado nao entra em `totalInvested` nas queries.

Resultado: o panorama e dashboard exibem apenas o rendimento real, o capital circula
invisivel no cash flow, e o saldo do mes reflete a realidade economica.

Usar `destination = 'transfer'` nao é correto para esse caso: esconde tambem o
rendimento, que some do panorama.

## Riscos E Limitacoes

- **Resgates parciais**: se o usuario resgata metade de um investimento, o capital
  calculado sera o total aportado ate aquele momento, nao a fracao proporcional. Pode
  subestimar o capital em multiplos resgates parciais do mesmo tipo.

- **Aportes editados apos o resgate**: `investmentReturnCapital` nao é recalculado.
  O valor fica desatualizado. Custo alto, cenario raro — nao recalcular automaticamente.

- **Tipos sem historico de aportes**: `investmentReturnCapital = 0`, rendimento = `amount`
  inteiro. Correto para o caso em que o usuario nao registrou o aporte historico.

- **Queda no grafico de patrimonio apos resgate + rolagem**: o patrimonio investido
  diminui pelo IR pago (perda real) e pelo rendimento extraido como receita (saiu do
  sistema de investimentos). Compensado parcialmente pelos novos aportes e rendimentos
  de outros tipos no mesmo mes. Comportamento correto — nao é bug.
