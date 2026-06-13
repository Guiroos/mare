# Auth & Actions

## Padrão obrigatório em toda action com mutação

```ts
const userId = await requireUserId()   // de @/lib/auth/require-user
const data = schema.parse(formData)    // xxxActionSchema quando input tem campos number
await assertOwns*(userId, data.id)     // de @/lib/auth/ownership
// DB operation
revalidatePath('...')
```

**Nunca** criar `requireUserId` local — sempre importar de `@/lib/auth/require-user`.

## Ownership checks

Importar `assertOwns*` antes de qualquer insert/update que referencie `categoryId`, `accountId`, `groupId`, `investmentTypeId`, `goalId`, `personId` ou `debtEntryId` vindo do cliente.

Quando a action já faz SELECT antes de mutar, paralelizar no mesmo `Promise.all`. Para assertOwns + fetch da mesma entidade, encadear com `.then()`:

```ts
const account = await Promise.all([
  assertOwnsPaymentAccount(userId, id).then(() =>
    db.select({ closingDay: paymentAccounts.closingDay })
      .from(paymentAccounts).where(eq(paymentAccounts.id, id))
      .then(rows => rows[0])
  ),
])
```

## Session

`session.user.id` é tipado via `types/next-auth.d.ts` (module augmentation) — **nunca** usar `(session.user as { id: string }).id`.

## Schemas de amount (`lib/validations/utils.ts`)

- `positiveAmountSchema` (> 0) — transações, entradas, resgates, contribuições
- `nonNegativeAmountSchema` (>= 0) — overrides de orçamento
- `nullishNonNegativeAmountSchema` (>= 0, nullish) — aportes/rendimentos que aceitam zero

Schemas de action vs formulário: quando input tem campos `number` (ex: `dueDay`, `totalInstallments`), usar `xxxActionSchema` — schemas sem sufixo são de formulário com strings de FormData.

## Cron routes

Não usam `requireUserId()` — não há sessão. Autenticam via `Authorization: Bearer ${CRON_SECRET}`. Operam direto no `db` iterando `userSettings`. Usar `Promise.allSettled` para isolamento de falhas por usuário.
