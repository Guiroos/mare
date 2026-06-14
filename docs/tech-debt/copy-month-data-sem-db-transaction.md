# Cópia de dados entre meses sem db.transaction()

**Status: resolvido**

## Problema

Duas actions que copiam dados do mês anterior para um mês novo executam um `DELETE`
seguido de um `INSERT` em operações separadas, sem `db.transaction()`. Se o `INSERT`
falhar após o `DELETE` ter sido commitado, o usuário perde os dados do mês destino
sem recuperação automática.

## Resolução

Ambas as funções agora usam `db.transaction()`:

| Arquivo | Função | Status |
| ------- | ------- | ------ |
| `lib/actions/transactions.ts` | `copyFixedExpensesFromPrevMonth` | Já estava resolvido antes desta sessão |
| `lib/actions/categories.ts` | `copyBudgetOverridesFromPrevMonth` | Resolvido em 2026-06-14 |

Teste de regressão em `__tests__/integration/actions-categories.test.ts` verifica
que `db.transaction` é chamado sempre que há overrides a copiar.
