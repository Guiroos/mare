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

## Por que não resolvemos agora

O risco de falha parcial num insert simples contra Neon serverless é baixo na prática.
Introduzir `db.transaction()` em apenas um lugar criaria inconsistência de estilo com
o restante do código. A decisão foi manter o padrão existente e resolver numa iniciativa
única que cubra todos os casos.

## Critério para revisitar

- Quando houver um terceiro caso ou quando um incidente real de inconsistência for
  reportado.
- Implementação: `db.transaction(async (tx) => { ... })` — Drizzle suporta transações
  com Neon via o driver `neon-http`. Todos os inserts da action devem usar `tx` em vez
  de `db` dentro do callback.

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
