# reorderCategoryGroups usa Promise.all sem db.transaction()

## Problema

`reorderCategoryGroups` dispara N updates em paralelo via `Promise.all`. Se um dos
updates falhar no meio da execução, os anteriores já foram commitados e a tabela
`categoryGroups` fica com `sortOrder` parcialmente atualizado — alguns grupos com
a nova ordem, outros com a antiga.

```ts
// lib/actions/categories.ts:54–61
await Promise.all(
  orderedIds.map((id, index) =>
    db.update(categoryGroups).set({ sortOrder: index }).where(...)
  )
)
```

## Ocorrências conhecidas

| Arquivo | Função |
| ------- | ------- |
| `lib/actions/categories.ts:54–61` | `reorderCategoryGroups` |

## Por que não resolvemos agora

Impacto é apenas visual (ordem dos grupos em `/categorias`). Uma falha parcial não
corrompe dados financeiros. O usuário pode reordenar novamente para corrigir.

## Solução planejada

Envolver em `db.transaction()` e executar os updates sequencialmente:

```ts
await db.transaction(async (tx) => {
  for (const [index, id] of orderedIds.entries()) {
    await tx.update(categoryGroups).set({ sortOrder: index }).where(
      and(eq(categoryGroups.id, id), eq(categoryGroups.userId, userId))
    )
  }
})
```

Alternativa: `Promise.all` dentro da transaction — Drizzle com `neon-serverless`
permite concorrência dentro de um bloco de transação.

## Critério para revisitar

- Numa iniciativa de hardening geral das actions multi-update.
