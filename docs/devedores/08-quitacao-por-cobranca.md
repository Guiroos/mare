# 08 — Quitação por Cobrança

## 1. Motivação

O modelo atual de devedores é **balance-forward**: registra cobranças e pagamentos e calcula o saldo corrente, mas não rastreia qual pagamento quitou qual cobrança específica. Isso impede responder perguntas como "o almoço de R$40 já foi pago?" mesmo quando vários pagamentos parciais já foram recebidos.

O objetivo desta feature é adicionar rastreabilidade de quitação em nível de cobrança individual, sem quebrar o modelo de balance math existente nem criar dados retroativos obrigatórios.

---

## 2. Modelo de Dados

### 2.1 Alterações na tabela `debtorEntries`

Adicionar duas colunas à tabela existente:

```ts
// Em lib/db/schema.ts — dentro de pgTable('debtor_entries', { ... })

status: varchar('status', { length: 20 }),
// null para type = 'payment' | 'adjustment'
// 'open' para charges novas (set no insert)
// 'settled' para charges quitadas

settledByPaymentId: uuid('settled_by_payment_id').references(
  (): AnyPgColumn => debtorEntries.id,
  { onDelete: 'set null' }
),
// FK self-referente: aponta para o debtor_entry de type='payment' que quitou esta charge
// null para: payments, adjustments, e charges ainda abertas
```

**Observações sobre a auto-referência em Drizzle:**

A auto-referência exige o padrão com função de retorno lazy e o tipo `AnyPgColumn` importado de `drizzle-orm/pg-core`:

```ts
import { AnyPgColumn } from 'drizzle-orm/pg-core'

// dentro da definição da tabela:
settledByPaymentId: uuid('settled_by_payment_id').references(
  (): AnyPgColumn => debtorEntries.id,
  { onDelete: 'set null' }
),
```

### 2.2 Índice adicional

```ts
// No terceiro parâmetro de pgTable (array de índices):
index('debtor_entries_settled_by_idx').on(t.settledByPaymentId),
```

Útil para a query inversa: "quais cobranças foram quitadas por este pagamento?".

### 2.3 Atualização de `debtorEntriesRelations`

```ts
export const debtorEntriesRelations = relations(debtorEntries, ({ one, many }) => ({
  user: one(users, { ... }),
  person: one(people, { ... }),
  sourceTransaction: one(transactions, { ... }),
  income: one(incomes, { ... }),
  // novas relações:
  settledByPayment: one(debtorEntries, {
    fields: [debtorEntries.settledByPaymentId],
    references: [debtorEntries.id],
    relationName: 'charge_settled_by',
  }),
  settledCharges: many(debtorEntries, { relationName: 'charge_settled_by' }),
}))
```

---

## 3. Migration SQL

Arquivo: `lib/db/migrations/0009_<nome_gerado>.sql`

```sql
-- Adiciona coluna status
ALTER TABLE "debtor_entries"
  ADD COLUMN "status" varchar(20);

-- Adiciona coluna de auto-referência
ALTER TABLE "debtor_entries"
  ADD COLUMN "settled_by_payment_id" uuid;

-- FK self-referente com set null ao deletar o payment
ALTER TABLE "debtor_entries"
  ADD CONSTRAINT "debtor_entries_settled_by_payment_id_fk"
  FOREIGN KEY ("settled_by_payment_id")
  REFERENCES "public"."debtor_entries"("id")
  ON DELETE set null ON UPDATE no action;

-- Índice para lookup inverso (payment → charges quitadas)
--> statement-breakpoint
CREATE INDEX "debtor_entries_settled_by_idx"
  ON "debtor_entries" USING btree ("settled_by_payment_id");

-- Backfill: setar status = 'open' em todas as charges existentes
--> statement-breakpoint
UPDATE "debtor_entries" SET "status" = 'open' WHERE "type" = 'charge';
```

Após gerar a migration com `npm run db:generate`, executar:
```bash
npx prettier --write lib/db/migrations/meta/
```

---

## 4. Regras de Negócio

### 4.1 Criação de cobranças

- Todo insert de `type = 'charge'` deve incluir `status = 'open'`.
- `settledByPaymentId` fica `null`.

### 4.2 Quitação via Fluxo A (ação direta na cobrança)

- Cria um `debtor_entry` de `type = 'payment'` com o `amount` exato da cobrança.
- Em seguida, faz `UPDATE debtor_entries SET status = 'settled', settled_by_payment_id = <novo_payment_id> WHERE id = <charge_id>`.
- Ambas as operações devem ocorrer na **mesma transação de banco** para garantir consistência.
- O `amount` do payment criado é sempre igual ao `amount` da charge — sem quitação parcial por este fluxo.
- Se a charge já tiver `status = 'settled'`, a action lança erro antes de prosseguir.

### 4.3 Quitação via Fluxo B (vinculação no pagamento manual)

- O pagamento é criado normalmente com o `amount` digitado pelo usuário.
- Para cada charge selecionada: `UPDATE debtor_entries SET status = 'settled', settled_by_payment_id = <novo_payment_id> WHERE id = <charge_id> AND user_id = <userId>`.
- O update das charges é feito em lote após o insert do payment.
- Não há validação de que `soma(charges selecionadas) == amount do payment` — o usuário pode vincular qualquer subconjunto. A UI exibe o comparativo como informação, não como bloqueio.
- Se `soma(charges selecionadas) > amount do payment`: exibir warning não-bloqueante na UI. O saldo math não é afetado.

### 4.4 Deleção de payment com charges vinculadas

- Antes de deletar, a action verifica se o payment tem charges vinculadas (`settledByPaymentId = id`).
- Ao deletar: executa `UPDATE debtor_entries SET status = 'open', settled_by_payment_id = null WHERE settled_by_payment_id = <payment_id>` para reabrir as charges.
- **Ordem obrigatória**: UPDATE charges → DELETE payment (para não acionar o SET NULL da FK antes de conseguir filtrar pelas charges).
- A FK `ON DELETE SET NULL` no banco garante que `settledByPaymentId` é limpo automaticamente se o payment for deletado diretamente no banco, mas o `status` não é resetado pela FK — por isso a action deve fazer o UPDATE explícito antes de deletar.

### 4.5 Deleção de charge com status settled

- O payment vinculado continua existindo normalmente — registrou um recebimento real.
- A charge é deletada normalmente; o payment fica órfão (sem charge vinculada), o que é aceitável.

### 4.6 Edição de charge settled

- Charges `settled` não podem ser editadas enquanto estiverem nesse status.
- Se o usuário precisar corrigir, deve primeiro deletar o payment vinculado (que reabre a charge).
- Na UI: o RowActions de charges `settled` omite a opção "Editar".

### 4.7 Tratamento de status null

- Para fins de UI e queries, `status IS NULL OR status = 'open'` equivale a "aberta".
- Nenhuma lógica deve assumir que `null` é diferente de `'open'` para o usuário.

---

## 5. Actions

### 5.1 `createDebtCharge` e `createDebtChargeFromTransaction` — modificar

Adicionar `status: 'open'` no insert. Sem mudança na assinatura.

### 5.2 `settleCharge` — nova action

```ts
export type SettleChargeInput = {
  chargeId: string
  personId: string
  entryDate: string
  createIncome: boolean
  referenceMonth?: string
  notes?: string
  // sem 'description': a action a deriva do registro da charge (já buscado na validação)
}

export async function settleCharge(data: SettleChargeInput): Promise<void>
```

**Corpo:**
1. `requireUserId()`
2. `settleChargeSchema.parse(data)`
3. Busca a charge: verifica existência, ownership (`userId`), `type === 'charge'`, `status !== 'settled'`; se `settled`, throw `'Cobrança já está quitada'`
4. Deriva `description = charge.description` do registro buscado no step 3
5. Todo o bloco abaixo dentro de `db.transaction(async (tx) => { ... })`:
   - Se `createIncome && referenceMonth`: insere em `incomes` via `tx`, obtém `incomeId`
   - Insere `debtor_entry` de `type = 'payment'` com `amount` e `description` da charge via `tx`, obtém `paymentId`
   - UPDATE na charge: `status = 'settled'`, `settledByPaymentId = paymentId` via `tx`
6. `revalidatePath` em `/devedores`, `/devedores/${personId}`, e se income: `/dashboard`, `/panorama`

### 5.3 `createDebtPayment` — modificar

Adicionar campo opcional `settleChargeIds?: string[]` no input. Após criar o payment, se `settleChargeIds.length > 0`:

```ts
await db
  .update(debtorEntries)
  .set({ status: 'settled', settledByPaymentId: paymentEntryId })
  .where(
    and(
      inArray(debtorEntries.id, data.settleChargeIds),
      eq(debtorEntries.userId, userId),
      eq(debtorEntries.type, 'charge')
    )
  )
```

O `userId` no WHERE garante ownership implicitamente — dispensa `assertOwnsDebtEntry` por item.

### 5.4 `deleteDebtEntry` — modificar

Antes do DELETE, se `entry.type === 'payment'`, envolver UPDATE + DELETE em `db.transaction`:

```ts
await db.transaction(async (tx) => {
  // Reabre charges vinculadas ANTES de deletar o payment
  await tx
    .update(debtorEntries)
    .set({ status: 'open', settledByPaymentId: null })
    .where(
      and(
        eq(debtorEntries.settledByPaymentId, data.id),
        eq(debtorEntries.userId, userId)
      )
    )

  if (data.alsoDeleteIncome && entry.incomeId) {
    await tx.delete(incomes).where(and(eq(incomes.id, entry.incomeId), eq(incomes.userId, userId)))
  }

  await tx
    .delete(debtorEntries)
    .where(and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)))
})
```

A transação garante que se o DELETE falhar, o UPDATE de reabertura das charges é revertido. Para `type !== 'payment'`, manter o comportamento atual sem transação.

### 5.5 `getOpenChargesForPerson` — nova query (em `lib/queries/debtors.ts`)

```ts
export type OpenChargeForLinking = {
  id: string
  description: string
  amount: number
  entryDate: string
}

export async function getOpenChargesForPerson(
  userId: string,
  personId: string
): Promise<OpenChargeForLinking[]>
```

Filtra: `type = 'charge' AND (status = 'open' OR status IS NULL) AND userId AND personId`, ordenado por `entryDate ASC`.

---

## 6. UX — Fluxo A: SettleChargeDialog

### 6.1 Gatilho

Na `EntryRow`, quando `entry.type === 'charge'` e `(entry.status === 'open' || entry.status === null)`:

- O `RowActions` ganha `additionalAction`:
  ```ts
  { label: 'Quitar', icon: CheckCircle, onClick: () => setSettleEntry(entry) }
  ```
- Estado `settleEntry: DebtEntryDetail | null` vive no `DebtEntryList`.

### 6.2 Componente `SettleChargeDialog`

Novo arquivo: `components/devedores/SettleChargeDialog.tsx`

**Props:**
```ts
type Props = {
  entry: DebtEntryDetail
  personId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}
```

**Campos:**

| Campo | Tipo | Default | Editável |
|---|---|---|---|
| Valor | Display read-only | `formatCurrency(entry.amount)` | Não |
| Data do recebimento | `<Input type="date">` | hoje | Sim |
| Registrar como entrada | `<Switch>` | `true` | Sim |
| Mês de referência | `<Input type="month">` | mês corrente | Condicional ao switch |
| Observações | `<Textarea>` | vazio | Sim |

- O valor é exibido como texto estático com `<Field label="Valor">` — não é `<CurrencyInput>`.
- Não há campo de descrição no dialog — ela é derivada automaticamente da charge no backend (`charge.description`).
- "Mês de referência" usa `<Input type="month">` — renderiza conforme o locale do browser, mesmo comportamento dos outros campos de mês no app.
- Botões: `Cancelar` (outline) + `Quitar` (primary).
- Responsivo: Dialog em `lg+`, Drawer em mobile.

---

## 7. UX — Fluxo B: Vinculação no DebtPaymentDialog

### 7.1 Dados necessários

```ts
type Props = {
  personId: string
  openCharges: OpenChargeForLinking[]  // novo prop
  open?: boolean
  onOpenChange?: (v: boolean) => void
}
```

Carregado na page do servidor junto com as outras queries:

```ts
const [data, txForLink, openCharges] = await Promise.all([
  getPersonDebtDetails(session.user.id, params.id),
  getTransactionsForDebtLink(session.user.id),
  getOpenChargesForPerson(session.user.id, params.id),
])
```

### 7.2 Seção de vinculação

Abaixo do campo "Observações", antes dos botões:

**Cabeçalho colapsável:**
- Texto: `"Vincular a cobranças abertas"` + badge `(N)` se `openCharges.length > 0`
- Default: colapsado
- Visível apenas se `openCharges.length > 0`

**Lista de charges (expandida):**
- Cada item: checkbox + descrição (flex-1, truncate) + valor (shrink-0, tabular-nums)
- `useState<string[]>` para `selectedChargeIds`

**Footer da lista:**
- `"R$ X,XX de R$ Y,YY selecionado"` com `tabular-nums`
- Se `X > Y`: `text-warning` — `"Valor selecionado excede o pagamento"` (não bloqueia)
- Se `X === Y` (tolerância R$0,01): `<Badge variant="positive" size="sm">Exato</Badge>`

**Integração com amount:**
- Adicionar `useState<number>` para `paymentAmountCents`
- Passar `onValueChange={setPaymentAmountCents}` ao `CurrencyInput` de amount

**Submit:**
- Passar `settleChargeIds: selectedChargeIds` à action `createDebtPayment`

---

## 8. UX — Histórico (`/devedores/[id]`)

### 8.1 Tipo `DebtEntryDetail` atualizado

```ts
export type DebtEntryDetail = {
  // ... campos existentes ...
  status: string | null
  settledByPaymentId: string | null
  settledCharges: Array<{
    id: string
    description: string
    amount: number
  }>
}
```

### 8.2 Query `getPersonDebtDetails` atualizada

Após buscar todas as entries, fazer uma segunda query para mapear charges quitadas por payment:

```ts
const paymentIds = rawEntries.filter(e => e.type === 'payment').map(e => e.id)

if (paymentIds.length > 0) {
  const settled = await db
    .select({
      settledByPaymentId: debtorEntries.settledByPaymentId,
      id: debtorEntries.id,
      description: debtorEntries.description,
      amount: debtorEntries.amount,
    })
    .from(debtorEntries)
    .where(
      and(
        inArray(debtorEntries.settledByPaymentId, paymentIds),
        eq(debtorEntries.userId, userId)
      )
    )
  // montar settledChargesMap: Record<string, Array<{id, description, amount}>>
  // usar toAmount() para converter amount (string decimal do Drizzle → number)
}
```

Incluir `settledCharges: settledChargesMap[e.id] ?? []` no map final.

### 8.3 Visual das linhas

**Charge `open` (ou status null):** visual atual, sem mudança.

**Charge `settled`:**
- Descrição com `line-through text-text-tertiary`
- Badge `variant="muted" size="sm"` com texto `"Quitada"` no subtítulo
- RowActions: sem opção "Editar"

**Payment com `settledCharges.length > 0`:**
- Linha adicional no subtítulo: `"Quitou: Almoço (R$40,00), Mercado (R$60,00)"`
- Se mais de 2 charges: truncar com `+N`
- `text-caption text-text-tertiary`, inline, não lista vertical

---

## 9. UX — Delete com Vínculos

### 9.1 Lógica de roteamento no `EntryRow`

```ts
const isPaymentWithSettled = entry.type === 'payment' && entry.settledCharges.length > 0

if (isPaymentWithSettled) {
  // PaymentWithSettledChargesDeleteDialog (trata income internamente também)
} else if (entry.type === 'payment' && entry.incomeId) {
  // PaymentWithIncomeDeleteDialog existente
} else {
  // RowActions.onDelete simples
}
```

### 9.2 Componente `PaymentWithSettledChargesDeleteDialog`

Novo arquivo: `components/devedores/PaymentWithSettledChargesDeleteDialog.tsx`

**Conteúdo:**
- Título: `"Excluir pagamento"`
- Descrição: `"Este pagamento quitou N cobrança(s). Excluí-lo vai reabrir essas cobranças."`
- Lista informativa das charges afetadas: `• [descrição] — R$ X,XX`
- Se `entry.incomeId`: `<Switch>` de `"Excluir também a entrada financeira vinculada"` (padrão `true`)
- Botões: `Cancelar` (ghost) + `Excluir` (danger)
- Responsivo: Dialog `lg+` + Drawer mobile

**Submit:**
- `deleteDebtEntry({ id: entry.id, alsoDeleteIncome })` — a action reabre charges internamente
- Toast: `"Pagamento excluído. Cobranças reabertas."`

---

## 10. Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---|---|---|
| `lib/db/schema.ts` | Modificar | Colunas `status` e `settledByPaymentId`; relações `settledByPayment` e `settledCharges`; importar `AnyPgColumn` |
| `lib/db/migrations/0009_*.sql` | Criar (gerado) | Migration gerada + backfill UPDATE manual |
| `lib/validations/debtors.ts` | Modificar | Adicionar `settleChargeSchema`; estender `debtPaymentSchema` com `settleChargeIds` |
| `lib/queries/debtors.ts` | Modificar | Expandir `DebtEntryDetail`; atualizar `getPersonDebtDetails`; adicionar `getOpenChargesForPerson` |
| `lib/actions/debtors.ts` | Modificar | `status: 'open'` nos inserts de charge; nova action `settleCharge`; `settleChargeIds` em `createDebtPayment`; reabrir charges em `deleteDebtEntry` |
| `components/devedores/SettleChargeDialog.tsx` | Criar | Dialog/drawer do Fluxo A |
| `components/devedores/PaymentWithSettledChargesDeleteDialog.tsx` | Criar | Dialog/drawer de delete com reabertura |
| `components/devedores/DebtEntryList.tsx` | Modificar | State `settleEntry`; RowActions com "Quitar"; visual settled/vinculado; roteamento de delete |
| `components/devedores/DebtPaymentDialog.tsx` | Modificar | Prop `openCharges`; seção de vinculação; `settleChargeIds` no submit |
| `app/(app)/devedores/[id]/page.tsx` | Modificar | `getOpenChargesForPerson` no `Promise.all`; prop `openCharges` ao dialog |

---

## 11. Ordem de Implementação

### Fase 1 — Schema e banco

1. Editar `lib/db/schema.ts`: colunas, FK lazy, índice, relações
2. `npm run db:generate`
3. `npx prettier --write lib/db/migrations/meta/`
4. Inserir `UPDATE ... SET status = 'open' WHERE type = 'charge'` manualmente na migration gerada
5. `npm run db:migrate`

### Fase 2 — Backend

6. `lib/validations/debtors.ts`: `settleChargeSchema` + extensão de `debtPaymentSchema`
7. `lib/actions/debtors.ts`: `status: 'open'` nos inserts; `settleCharge`; `settleChargeIds` em `createDebtPayment`; reabertura em `deleteDebtEntry`
8. `lib/queries/debtors.ts`: `DebtEntryDetail` expandido; `getPersonDebtDetails` atualizado; `getOpenChargesForPerson`

### Fase 3 — UI: Fluxo A

9. Criar `SettleChargeDialog.tsx`
10. Editar `DebtEntryList.tsx`: state, RowActions, visual settled

### Fase 4 — UI: Fluxo B

11. Editar `DebtPaymentDialog.tsx`: prop, seção de vinculação, submit
12. Editar `app/(app)/devedores/[id]/page.tsx`: query + prop

### Fase 5 — UI: Delete com vínculos

13. Criar `PaymentWithSettledChargesDeleteDialog.tsx`
14. Editar `DebtEntryList.tsx`: roteamento para o novo dialog

### Fase 6 — Validação

15. `npm run lint && npx prettier --check . && npx tsc --noEmit`
16. Testar via Playwright: Fluxo A, Fluxo B, delete, visual do histórico
