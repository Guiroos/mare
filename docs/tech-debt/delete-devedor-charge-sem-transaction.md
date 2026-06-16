# deleteDebtEntry (charge/adjustment) sem db.transaction()

## Problema

Em `deleteDebtEntry`, quando `entry.type === 'payment'` a deleção já usa
`db.transaction()` corretamente. Mas quando o tipo é `'charge'` ou `'adjustment'`
e `data.alsoDeleteIncome === true`, os dois deletes são sequenciais sem transação:

```ts
// lib/actions/debtors.ts:362–370
} else {
  if (data.alsoDeleteIncome && entry.incomeId) {
    await db.delete(incomes).where(...)   // ← 1º delete, sem tx
  }
  await db.delete(debtorEntries).where(...) // ← 2º delete, sem tx
}
```

Se o segundo `DELETE` falhar após o primeiro ter sido executado, o income é removido
mas o `debtorEntry` permanece com `incomeId` apontando para um registro inexistente.
A FK em `debtorEntries.incomeId` provavelmente é `SET NULL` ou `CASCADE`, mas a
assimetria existe e o comportamento depende do schema.

## Ocorrências conhecidas

| Arquivo | Linhas |
| ------- | ------ |
| `lib/actions/debtors.ts` | 362–370 |

## Por que não resolvemos agora

O caminho `type !== 'payment'` com `alsoDeleteIncome: true` é menos frequente
(cobranças/ajustes que geraram income). Sem incidente real.

## Solução planejada

Envolver o bloco `else` num `db.transaction()`:

```ts
} else {
  await db.transaction(async (tx) => {
    if (data.alsoDeleteIncome && entry.incomeId) {
      await tx.delete(incomes).where(...)
    }
    await tx.delete(debtorEntries).where(...)
  })
}
```

## Critério para revisitar

- Numa iniciativa de hardening geral das actions com múltiplas mutações.
- Antes de expor a funcionalidade `alsoDeleteIncome` a mais casos de uso.
