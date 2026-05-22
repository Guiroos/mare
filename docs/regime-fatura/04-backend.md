# Regime de Fatura — Backend

## Validações

### `creditModeSchema` (`lib/validations/settings.ts`)

```ts
const creditModeSchema = z.object({
  creditMode: z.enum(['accrual', 'fatura']),
  faturaActiveFrom: yearMonthSchema.optional(),
})
.refine(
  (d) => d.creditMode === 'accrual' || !!d.faturaActiveFrom,
  { message: 'Mês de ativação obrigatório para regime de fatura', path: ['faturaActiveFrom'] }
)
```

### `faturaPaymentActionSchema` (`lib/validations/fatura.ts`)

```ts
const faturaPaymentActionSchema = z.object({
  faturaAccountId: z.string().uuid(),
  faturaCycleMonth: referenceMonthSchema,   // YYYY-MM-01
  sourceAccountId:  z.string().uuid(),
  amount:           positiveAmountSchema,
  date:             z.string().date(),
})
```

## Queries (`lib/queries/fatura.ts`)

### `getUserCreditMode(userId)`

Retorna `{ creditMode, faturaActiveFrom }` do usuário. Retorna `{ creditMode: 'accrual', faturaActiveFrom: null }` se não houver registro em `user_settings`.

### `getFaturaState(userId, accountId, referenceMonth)`

Retorna o estado de um ciclo de faturamento:

```ts
type FaturaState = {
  account: { id: string; name: string; closingDay: number }
  cycleStart: Date
  cycleEnd: Date
  cycleMonth: string        // YYYY-MM-01
  total: number             // soma das transações + gastos fixos de crédito do ciclo
  transactionTotal: number
  fixedExpenseTotal: number
  payment: {
    id: string
    amount: number
    date: Date
    referenceMonth: string
  } | null                  // null = não pago
}
```

Lógica:
1. Busca `paymentAccount` e valida `type = 'credit'` e `closingDay > 1`
2. Calcula `cycleStart` e `cycleEnd` via `billingCycleDateRange`
3. Soma transações onde `accountId = account.id` e `date BETWEEN cycleStart AND cycleEnd`
4. Soma gastos fixos de crédito do mesmo ciclo usando a regra de
   `getFixedExpensesByBillingCycle`: `dueDay >= closingDay` no mês anterior ou
   `dueDay < closingDay` no mês do ciclo, filtrando `accountId = account.id`
5. `total = transactionTotal + fixedExpenseTotal`
6. Busca transação com `faturaAccountId = account.id` e `faturaCycleMonth = cycleMonth`

### `getOpenFaturas(userId)`

Retorna todas as contas de crédito do usuário com `closingDay > 1` e, para cada uma, o
estado do ciclo mais recente. Usado para montar os cards do dashboard.

Lógica:
1. Busca todas as contas `type = 'credit'` com `closingDay > 1` — mesmo critério de
   `getCreditAccounts` em `lib/queries/categories.ts`; `closingDay <= 1` é inválido
   para cálculo de ciclo (`billingCycleDateRange` retorna `null` nesses casos)
2. Para cada conta, determina qual é o ciclo atual (aberto) e o ciclo anterior (fechado)
   usando `todayParts()`:
   - `today.day <= closingDay - 1`: ciclo aberto = mês atual; ciclo fechado = mês anterior
   - `today.day >= closingDay`: ciclo aberto = próximo mês; ciclo fechado = mês atual
   - exemplo com `closingDay = 20`: em 05/Mai, o ciclo aberto é Maio
     (20/Abr-19/Mai); em 25/Mai, o ciclo aberto é Junho (20/Mai-19/Jun)
3. Busca pagamentos de fatura existentes para **todas** as contas/ciclos relevantes em uma
   única query com `inArray(transactions.faturaAccountId, accountIds)` e
   `inArray(transactions.faturaCycleMonth, cycleMonths)` — não fazer query por conta
   individualmente (N+1)
4. Se não houver contas elegíveis, retorna `[]` antes de montar queries com `inArray`
5. Retorna ciclo fechado sem pagamento com prioridade (estado de alerta)

### Modificações em Queries Existentes

Todas as queries que somam despesas precisam aceitar `creditMode` e `faturaActiveFrom`
como parâmetros e bifurcar o cálculo.

Queries afetadas (nomes reais no codebase):

| Query | Arquivo | Natureza |
| ----- | ------- | -------- |
| `getDashboardData` | `lib/queries/dashboard.ts` | listas carregadas + `reduce` em JS |
| `getCategoryGroupProgress` | `lib/queries/dashboard.ts` | `SUM GROUP BY` por categoria em SQL |
| `getMonthlyEvolution` | `lib/queries/dashboard.ts` | **agregação SQL** — ver nota abaixo |
| `getAnnualOverview` | `lib/queries/panorama.ts` | **agregação SQL** — ver nota abaixo |
| `getAnnualExpensesByGroup` | `lib/queries/panorama.ts` | lista anual + agrupamento em memória por categoria |

> Não existem `getMonthSummary`, `getCategoryExpenses` ou `getMonthBudget` como funções
> independentes. O orçamento é calculado dentro de `getCategoryGroupProgress`.

### `getDashboardData`: filtrar listas já carregadas

`getDashboardData` não faz query de `SUM`; ele chama `getMonthTransactions` e
`getMonthFixedExpenses`, depois calcula os totais com `reduce`. A bifurcação de regime
deve acontecer em memória, sem adicionar uma segunda query de soma:

```ts
const isFaturaMonth =
  creditMode === 'fatura' &&
  faturaActiveFrom !== null &&
  referenceMonth >= faturaActiveFrom

const creditIdSet = new Set(creditAccountIds)
const shouldFilterCredit = isFaturaMonth && creditAccountIds.length > 0

const expenseTransactions = shouldFilterCredit
  ? monthTransactions.filter((t) => !creditIdSet.has(t.accountId))
  : monthTransactions

const expenseFixedExpenses = shouldFilterCredit
  ? fixedExpenseList.filter((e) => !creditIdSet.has(e.accountId))
  : fixedExpenseList

const totalExpenses =
  expenseTransactions.reduce((s, t) => s + toAmount(t.amount), 0) +
  expenseFixedExpenses.reduce((s, e) => s + toAmount(e.amount), 0)
```

Não somar `faturaAccountId IS NOT NULL` separadamente aqui: o pagamento de fatura já foi
incluído por ter `accountId` da conta de origem débito/pix.

O `unpaidFixedCount` do dashboard também precisa usar a lista filtrada em meses de fatura.
Caso contrário, gastos fixos no cartão continuam aparecendo como pendência individual mesmo
quando serão pagos pela fatura.

### `getCategoryGroupProgress`: filtrar no SQL

`getCategoryGroupProgress` já usa `SUM GROUP BY` em SQL. Aqui o filtro Drizzle continua
sendo o caminho correto, mas a query de `transactions` precisa lidar com `categoryId`
nullable:

```ts
const isFaturaMonth =
  creditMode === 'fatura' &&
  faturaActiveFrom !== null &&
  referenceMonth >= faturaActiveFrom

// Sempre guardar antes de usar notInArray — array vazio gera SQL inválido
const hasCreditAccounts = creditAccountIds.length > 0

// transactions: excluir crédito direto; pagamento de fatura fica sem categoria
// e não deve entrar no progresso por categoria
const txWhere = isFaturaMonth && hasCreditAccounts
  ? and(
      eq(transactions.userId, userId),
      eq(transactions.referenceMonth, referenceMonth),
      notInArray(transactions.accountId, creditAccountIds),
      isNotNull(transactions.categoryId),
    )
  : and(
      eq(transactions.userId, userId),
      eq(transactions.referenceMonth, referenceMonth),
      isNotNull(transactions.categoryId),
    )

// fixedExpenses: mesma exclusão
const fxWhere = isFaturaMonth && hasCreditAccounts
  ? and(
      eq(fixedExpenses.userId, userId),
      eq(fixedExpenses.referenceMonth, referenceMonth),
      notInArray(fixedExpenses.accountId, creditAccountIds),
    )
  : and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth))
```

Se a query não usar `isNotNull`, o `GROUP BY` pode retornar uma linha com
`categoryId = null`; essa linha deve ser ignorada antes de preencher `spentMap`.

**Queries de agregação SQL** (`getMonthlyEvolution`, `getAnnualOverview`): estas fazem
`sum(transactions.amount) GROUP BY referenceMonth` em SQL direto para múltiplos meses de
uma só vez. Bifurcar exige `LEFT JOIN` com `paymentAccounts` dentro do `SUM` para somar
apenas transações cuja conta não seja `type = 'credit'` nos meses com regime ativo. Não
somar pagamentos de fatura em query separada: eles já entram nesse filtro por serem
gravados na conta de origem débito/pix. É a parte mais complexa da Fase 5 — tratar
separadamente e não assumir que o mesmo padrão de `getDashboardData` se aplica
automaticamente.

O mesmo vale para `fixedExpenses`: em meses com regime de fatura, a agregação anual/mensal
deve excluir linhas cuja conta seja `type = 'credit'`, porque esses valores entram no
pagamento da fatura.

**Panorama por grupo** (`getAnnualExpensesByGroup`): ao tornar `transactions.categoryId`
nullable, `categoryToGroup.get(t.categoryId)` precisa ignorar `null` antes do lookup. Para
meses em regime de fatura, aplicar a mesma exclusão de contas de crédito; pagamentos de
fatura sem categoria não entram no breakdown por grupo.

Carregar `creditMode`, `faturaActiveFrom` e `creditAccountIds` uma vez no início do
request e passar para todas as queries em vez de fazer lookup individual em cada função.

## Actions (`lib/actions/fatura.ts`)

### `updateCreditMode(data)`

Ordem obrigatória: `requireUserId()` → `creditModeSchema.parse(data)` → validar trava de
pagamentos existentes (ver abaixo) → upsert em `user_settings` com
`.onConflictDoUpdate({ target: [userSettings.userId], set: { ... } })` →
`revalidatePath('/dashboard')`, `revalidatePath('/panorama')`.

Ao desativar (`creditMode = 'accrual'`): zerar `faturaActiveFrom = null`.

**Validação de alteração:** se já existir qualquer pagamento de fatura do usuário
(`transactions.faturaAccountId IS NOT NULL`), rejeitar alteração de `creditMode` ou
`faturaActiveFrom`. Essa trava evita meses recalculados com pagamentos já materializados.
Para corrigir a data de ativação, o usuário deve deletar os pagamentos de fatura e salvar
a configuração novamente.

### `createFaturaPayment(data)`

Ordem obrigatória:
1. `requireUserId()`
2. `faturaPaymentActionSchema.parse(data)`
3. `assertOwnsPaymentAccount(userId, faturaAccountId)` — conta de crédito
4. `assertOwnsPaymentAccount(userId, sourceAccountId)` — conta de débito
5. Buscar as duas contas e validar tipos (`faturaAccountId` = `credit`; `sourceAccountId`
   = `debit` ou `pix`)
6. Validar que o usuário está com `creditMode = 'fatura'` e que
   `faturaCycleMonth >= faturaActiveFrom`
7. Validar que `data.date >= cycleEnd + 1`
8. Recalcular total do ciclo no servidor, incluindo transações e gastos fixos de crédito
   (não confiar no valor do cliente)
9. Validar o valor em centavos (`toAmount(data.amount) * 100 === totalCicloEmCentavos`)
   — rejeitar se divergir
10. Validar que não existe pagamento para `(userId, faturaAccountId, faturaCycleMonth)`
11. Inserir `transaction` com `faturaAccountId`, `faturaCycleMonth`, `referenceMonth`
   derivado de `data.date` e `categoryId = null` — `referenceMonth` é o mês do pagamento
   (não o mês do ciclo)
12. `revalidatePath('/dashboard')`, `revalidatePath('/panorama')`

**Edge cases:**
- `faturaAccountId` não é `type = 'credit'`: rejeitar com erro
- `sourceAccountId` é `type = 'credit'`: rejeitar com erro
- Ciclo sem `closingDay > 1`: rejeitar na action (não deve chegar, mas validar)
- Regime desativado ou ciclo anterior a `faturaActiveFrom`: rejeitar
- Data de pagamento anterior ao fechamento do ciclo: rejeitar
- Ciclo com total zero: rejeitar; não há fatura a pagar
- Valor do ciclo mudou entre o client carregar e o usuário confirmar: o servidor
  recalcula e rejeita se o valor enviado não bater — o client deve recarregar e
  mostrar o novo valor
- Pagamento de fatura não deve passar por `createTransaction`/`updateTransaction`
  genéricos, porque esses fluxos continuam exigindo `categoryId`

## Ownership

`user_settings` é sempre scoped ao próprio usuário — usar `requireUserId()` diretamente,
sem necessidade de `assertOwns*` adicional.

`assertOwnsPaymentAccount` já existe em `lib/auth/ownership.ts` — usar para validar
`faturaAccountId` e `sourceAccountId` na action `createFaturaPayment`.

## Revalidação

| Action | Paths revalidados |
| ------ | ----------------- |
| `updateCreditMode` | `/dashboard`, `/panorama` |
| `createFaturaPayment` | `/dashboard`, `/panorama` |
