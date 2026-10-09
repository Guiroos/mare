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

## Falha esperada: `ActionResult`, não `throw`

Em build de produção o React mascara a mensagem de `Error` lançado por Server Action — o cliente recebe um erro genérico, nunca o texto (#34). Toda falha que o **usuário** pode causar e precisa entender (validação de negócio, conflito, estado que mudou) devolve `ActionResult` de `lib/actions/types.ts`:

```ts
export async function createX(data: unknown): Promise<ActionResult> {
  // ...
  if (conflito) return { ok: false, code: 'duplicate_x', message: 'Já existe um X para este mês' }
  // ...
  return { ok: true, data: undefined }
}
```

O cliente lê `result.ok` / `result.message`; o `code` é o contrato estável (a UI pode ramificar nele). `throw` fica para o excepcional que o usuário não provoca pela UI — registro não encontrado após `assertOwns*`, invariante violada. Referências: `lib/actions/fatura.ts`, `archiveInvestmentType` em `lib/actions/investments.ts`.

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

Comparar o secret com `crypto.timingSafeEqual` (não `!==`) e **recusar quando `CRON_SECRET` não estiver definido** — senão o header `Bearer undefined` bateria com a env não-setada e passaria. `timingSafeEqual` exige buffers de mesmo tamanho: guardar com `provided.length === expected.length` antes.
