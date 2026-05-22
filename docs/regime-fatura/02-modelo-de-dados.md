# Regime de Fatura — Modelo de Dados

## Tabela `user_settings` (nova)

Preferências do usuário que não fazem parte do schema do NextAuth. Separada de `users`
para não conflitar com o Drizzle adapter do NextAuth.

| Campo              | Tipo         | Obrigatório | Notas                                              |
| ------------------ | ------------ | ----------- | -------------------------------------------------- |
| `id`               | uuid         | sim         | primary key                                        |
| `userId`           | uuid         | sim         | referencia `users.id`, cascade delete; unique      |
| `creditMode`       | varchar(20)  | sim         | `'accrual'` (default) \| `'fatura'`                |
| `faturaActiveFrom` | date         | não         | `YYYY-MM-01`; obrigatório quando `creditMode = 'fatura'` |
| `updatedAt`        | timestamp    | —           | default now; atualizar manualmente nas actions     |

Regras:
- Um único registro por usuário (unique em `userId`)
- Quando `creditMode = 'fatura'`, `faturaActiveFrom` nunca é nulo
- `faturaActiveFrom` só pode ser alterado enquanto não houver nenhum pagamento de fatura
  registrado. Depois do primeiro pagamento, a data fica travada; para corrigir a ativação,
  o usuário precisa deletar os pagamentos de fatura criados e ajustar novamente.
- Ao desativar (`creditMode = 'accrual'`), `faturaActiveFrom` deve ser zerado para null

Check constraint recomendado:

```sql
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_credit_mode_check"
CHECK (
  ("credit_mode" = 'accrual' AND "fatura_active_from" IS NULL)
  OR
  ("credit_mode" = 'fatura' AND "fatura_active_from" IS NOT NULL)
);
```

## Alterações em `transactions`

### `categoryId` passa a aceitar `null`

O schema atual define `transactions.categoryId` como `notNull()`. Isso bloqueia a
decisão funcional de que pagamento de fatura é uma saída única sem categoria.

**Decisão v1:** tornar `transactions.categoryId` nullable, mantendo a FK para
`categories.id`.

Regras:
- Transações normais (`faturaAccountId IS NULL`) continuam exigindo `categoryId`.
- Pagamentos de fatura (`faturaAccountId IS NOT NULL`) devem gravar `categoryId = null`.
- `createTransaction`, `updateTransaction`, parcelas e formulários existentes continuam
  validando `categoryId` obrigatório; apenas `createFaturaPayment` pode inserir `null`.
- A migration deve remover o `NOT NULL` de `transactions.category_id`, sem alterar
  `fixedExpenses.categoryId`, `installmentGroups.categoryId` ou `monthlyBudgetOverrides.categoryId`.

Check constraint recomendado na migration manual:

```sql
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fatura_category_check"
CHECK (
  ("fatura_account_id" IS NULL AND "fatura_cycle_month" IS NULL AND "category_id" IS NOT NULL)
  OR
  ("fatura_account_id" IS NOT NULL AND "category_id" IS NULL AND "fatura_cycle_month" IS NOT NULL)
);
```

### Campos adicionados

| Campo             | Tipo | Obrigatório | Notas                                                   |
| ----------------- | ---- | ----------- | ------------------------------------------------------- |
| `faturaAccountId` | uuid | não         | referencia `paymentAccounts.id`, `onDelete: restrict`; presente apenas em pagamentos de fatura |
| `faturaCycleMonth`| date | não         | `YYYY-MM-01`; ciclo de faturamento que este pagamento quita; presente apenas quando `faturaAccountId` não é nulo |

Regras:
- `faturaAccountId` e `faturaCycleMonth` são sempre nulos ou sempre preenchidos juntos
- A conta referenciada em `faturaAccountId` deve ser `type = 'credit'`
- A conta de débito da transação (campo `accountId` existente) deve ser `type = 'debit'` ou `'pix'`
- Pagamento de fatura sempre usa `categoryId = null`
- Não pode existir mais de um pagamento de fatura para o mesmo `(userId, faturaAccountId, faturaCycleMonth)`
- O `amount` do pagamento deve ser igual à soma das transações **e dos gastos fixos de crédito**
  do ciclo no momento do registro

`onDelete: restrict` em `faturaAccountId` é intencional. `set null` quebraria a check
constraint do pagamento de fatura e apagaria o vínculo necessário para saber qual ciclo foi
quitado.

## Campos Existentes Sem Alteração

`paymentAccounts` já tem `type: 'credit' | 'debit' | 'pix'` e `closingDay: integer | null`.
Nenhum campo novo é necessário nessa tabela.

**Gotcha de `closingDay`:** `getCreditAccounts` em `lib/queries/categories.ts` filtra com
`gt(paymentAccounts.closingDay, 1)` — não apenas `IS NOT NULL`. `billingCycleDateRange`
retorna `null` para `closingDay <= 1`. Toda lógica de regime de fatura que busca contas
de crédito elegíveis deve usar o mesmo critério `> 1`, não apenas `!= null`.

## Ciclo de Faturamento e `faturaCycleMonth`

Determinado por `closingDay` da conta. Usa a função existente `billingCycleDateRange` de
`lib/utils/date.ts`.

**Semântica de `closingDay`:** é o **primeiro dia do novo ciclo**, não o último.
O ciclo anterior termina em `closingDay - 1`.

Exemplo — `closingDay = 20`, fatura de Maio:
- Ciclo: 20/Abr a 19/Mai (não 21/Abr–20/Mai)
- `billingCycleDateRange("2025-05", 20)` → `{ start: "2025-04-20", end: "2025-05-19" }`

**`faturaCycleMonth`** armazena o parâmetro `yearMonth` passado a `billingCycleDateRange`
— ou seja, o mês "dono" do ciclo. Para o ciclo 20/Abr–19/Mai, `faturaCycleMonth = '2025-05-01'`.
Isso significa "a fatura de Maio" independentemente de quando a compra foi feita.

> A v1 não armazena `dueDay` por conta. A data de vencimento pode ser exibida no card
> como "após 19/Mai" (data de fim do ciclo) sem precisar de um campo adicional.

## Unicidade

Índice único para evitar pagamento duplicado de fatura. Deve ser **partial index** —
aplicar somente quando `faturaAccountId IS NOT NULL`. A versão atual do Drizzle já suporta
`.where(sql\`...\`)` em índices Postgres, então declarar no schema em vez de gerar índice
regular e editar depois:

```ts
// importar sql de drizzle-orm
uniqueIndex('transactions_fatura_unique_idx')
  .on(t.userId, t.faturaAccountId, t.faturaCycleMonth)
  .where(sql`${t.faturaAccountId} IS NOT NULL`)
```

A action `createFaturaPayment` valida duplicata antes de inserir como camada adicional de segurança.

## Lógica de Cálculo de Despesas (Bifurcação)

Para um dado `userId` e `referenceMonth`:

```
se creditMode = 'accrual' OU referenceMonth < faturaActiveFrom:
  despesas = soma de transactions onde referenceMonth = M
           + soma de fixedExpenses onde referenceMonth = M
             (comportamento atual)

se creditMode = 'fatura' E referenceMonth >= faturaActiveFrom:
  despesas = soma de transactions onde referenceMonth = M
               E accountId NÃO IN (creditAccountIds)   ← inclui pagamento de fatura via conta débito/pix
           + soma de fixedExpenses onde referenceMonth = M
               E accountId NÃO IN (creditAccountIds)   ← gastos fixos de crédito entram na fatura
```

**Gotcha:** `notInArray(col, ids)` gera SQL inválido se `ids` for vazio (sem contas de
crédito cadastradas). Sempre guardar com `if (creditAccountIds.length > 0)` antes de
aplicar o filtro; se vazio, omitir o filtro (comportamento equivale ao accrual).

**Não somar pagamentos de fatura separadamente.** Como `createFaturaPayment` grava
`accountId = sourceAccountId` (débito/pix), o filtro `accountId NOT IN (creditAccountIds)`
já inclui essa transação no caixa do mês. Uma segunda soma por `faturaAccountId IS NOT NULL`
duplicaria a despesa.

**Gastos fixos no crédito:** se um gasto fixo usa conta de crédito em mês com regime de
fatura, ele não entra diretamente no dashboard. Ele precisa entrar no cálculo da fatura do
ciclo correspondente, usando a mesma regra de `getFixedExpensesByBillingCycle`
(`dueDay >= closingDay` no mês anterior ou `dueDay < closingDay` no mês do ciclo).

**Orçamento por categoria:** pagamentos de fatura têm `categoryId = null`; portanto entram
no total de despesas do dashboard, mas não entram em `getCategoryGroupProgress`. A query de
progresso por categoria deve filtrar `isNotNull(transactions.categoryId)` ou ignorar
explicitamente linhas agregadas com `categoryId = null`.

## Índices

| Tabela         | Nome                              | Colunas                                  | Motivo                                     |
| -------------- | --------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `user_settings`| `user_settings_user_idx`          | `(userId)`                               | lookup por usuário                         |
| `transactions` | `transactions_fatura_unique_idx` | `(userId, faturaAccountId, faturaCycleMonth)` parcial | queries de estado de fatura e unicidade |

## Arquivos Criados/Alterados

| Ação     | Arquivo                     |
| -------- | --------------------------- |
| Criado   | `lib/db/schema.ts` — tabela `user_settings` |
| Alterado | `lib/db/schema.ts` — campos `faturaAccountId` e `faturaCycleMonth` em `transactions` |
| Alterado | `lib/db/schema.ts` — `transactions.categoryId` nullable apenas para pagamento de fatura |
| Alterado | `lib/db/schema.ts` — partial unique index e check constraints de fatura |
| Gerado   | `lib/db/migrations/XXXX_regime_fatura.sql` |
