# Actions multi-tabela sem transação de banco

## Problema

Actions que escrevem em duas tabelas em sequência não usam `db.transaction()`. Se o
segundo insert falhar após o primeiro ter sido commitado, o banco fica em estado
inconsistente.

## Ocorrências conhecidas

Nenhuma ocorrência pendente.

## Resolvidas

| Arquivo | Quando | Como |
| ------- | ------ | ---- |
| `lib/actions/debtors.ts` — `createDebtPayment` | Fase 8 devedores | Migrado para `db.transaction()` — income + payment entry + charge updates num único bloco atômico. |
| `lib/actions/debtors.ts` — `deleteDebtEntry` (payment) | Fase 8 devedores | Migrado para `db.transaction()` — reabertura de charges + delete do payment em ordem garantida. |
| `lib/actions/investments.ts` — `createWithdrawal` | Consolidação de transações | Migrado para `db.transaction()` — income + withdrawal num único bloco atômico. |
| `lib/actions/investments.ts` — `updateWithdrawal` | Consolidação de transações | Migrado para `db.transaction()` — update do withdrawal + update do income vinculado num único bloco atômico. |
| `lib/actions/investments.ts` — `deleteWithdrawal` | Consolidação de transações | Migrado para `db.transaction()` — delete do withdrawal + delete do income vinculado num único bloco atômico. |
| `lib/actions/transactions.ts` — `copyFixedExpensesFromPrevMonth` | Consolidação de transações | Migrado para `db.transaction()` — DELETE + INSERT atômicos; falha no insert não deixa o mês sem gastos fixos. |
| `lib/actions/transactions.ts` — `updateInstallmentGroup` | Consolidação de transações | Migrado para `db.transaction()` — UPDATE do grupo + fetch + UPDATE das parcelas filhas num único bloco atômico. |
| `lib/actions/debtors.ts` — `deleteDebtEntry` (charge/adjustment) | Consolidação de transações | Migrado para `db.transaction()` — DELETE do income vinculado + DELETE do entry num único bloco atômico. |

## Por que não resolvemos agora

N/A — todas as ocorrências identificadas foram resolvidas.

## Critério para revisitar

Qualquer nova action que escreva em duas ou mais tabelas em sequência deve usar
`db.transaction()` desde o início.

## Exemplo de correção

```ts
// antes
const [income] = await db.insert(incomes).values({...}).returning({ id: incomes.id })
await db.insert(debtorEntries).values({ ..., incomeId: income.id })

// depois
await db.transaction(async (tx) => {
  const [income] = await tx.insert(incomes).values({...}).returning({ id: incomes.id })
  await tx.insert(debtorEntries).values({ ..., incomeId: income.id })
})
```
