# Ajuste de saldo via conciliação no pagamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir conciliar a diferença de um pagamento parcial contra cobranças abertas registrando um lançamento de `adjustment` (abatimento), de modo que o saldo do devedor zere corretamente.

**Architecture:** O tipo `adjustment` já existe no enum de `debtorEntries`. Passa a ter semântica de **valor com sinal** (negativo reduz o saldo). A conciliação vive no dialog de pagamento mas gera **duas entradas atômicas** (payment + adjustment) numa `db.transaction`; o servidor calcula o abatimento a partir das cobranças selecionadas. Nenhuma migration — `type` é `varchar(20)` sem check e `amount` é `text` (aceita `"-100.00"`).

**Tech Stack:** Next.js 14 (App Router), Drizzle ORM, Neon PostgreSQL, Vitest (integração com `neon-testing`), React Server Actions, criptografia MEK/DEK por campo.

## Global Constraints

- Toda action de mutação: `requireUserId()` → `schema.parse` → `assertOwns*` → DB → `revalidatePath`. Nunca criar `requireUserId` local.
- Campos sensíveis (`amount`, `description`, `notes`) sempre via `encryptField`/`encryptOptional`; leitura via `decryptField`/`decryptOptional` com a DEK de `getDekForUser(userId)`.
- `toAmount(decryptField(...))` para converter `amount` (string/ciphertext) em número. `decryptField` é backward-compat: plaintext (ex.: factory `"500.00"`) passa direto.
- Testes de integração: `neonTestingSetup()` no escopo global; `createTestDb()` e imports dinâmicos de módulos que tocam `lib/db` **dentro** do `beforeAll`/`it` (a URL do branch só existe após o setup). `vi.mock('next/cache', ...)` obrigatório em arquivos que chamam actions reais.
- Antes de commitar: `npm run lint && npm run format:check && npm run typecheck && npm test`.
- Hook `PostToolUse:Edit` bloqueia edits com imports não usados — ao adicionar imports + múltiplas mudanças num componente, preferir reescrever o arquivo inteiro com `Write`.
- DS Maré: cor neutra `text-text-secondary`, `Badge variant="muted"`, `tabular-nums` em valores; zero valores arbitrários de Tailwind.

---

### Task 1: Factory `createAdjustment` + correção dos contadores no saldo

**Files:**
- Modify: `__tests__/integration/helpers/factories.ts` (após `createPayment`, ~L138)
- Modify: `lib/queries/debtors.ts:233-244` (laço `summary` de `getPersonDebtDetails`)
- Test: `__tests__/integration/debtors.test.ts`

**Interfaces:**
- Consumes: `getPersonDebtDetails(userId, personId): Promise<PersonDebtDetails>` cujo `.summary` tem `{ balance, totalCharged, totalPaid, lastMovement, chargeCount, paymentCount }`.
- Produces: `createAdjustment(db, userId, personId, overrides?) => { id }` — insere `debtorEntries` com `type: 'adjustment'`, `amount` plaintext com sinal (default `'-100.00'`), `status: null`.

- [ ] **Step 1: Adicionar a factory `createAdjustment`**

Em `__tests__/integration/helpers/factories.ts`, logo após a função `createPayment`:

```ts
export async function createAdjustment(
  db: TestDb,
  userId: string,
  personId: string,
  overrides: Partial<typeof schema.debtorEntries.$inferInsert> = {}
) {
  const [entry] = await db
    .insert(schema.debtorEntries)
    .values({
      userId,
      personId,
      type: 'adjustment',
      amount: '-100.00',
      description: 'Ajuste teste',
      entryDate: '2025-01-20',
      referenceMonth: '2025-01-01',
      status: null,
      ...overrides,
    })
    .returning({ id: schema.debtorEntries.id })
  return entry
}
```

- [ ] **Step 2: Escrever o teste que falha (contadores)**

Em `__tests__/integration/debtors.test.ts`: adicionar `createAdjustment` ao import de `./helpers/factories` (junto de `createCharge`, `createPayment`) e o bloco:

```ts
describe('getPersonDebtDetails — ajustes no saldo', () => {
  it('ajuste negativo zera o saldo e NÃO conta como cobrança', async () => {
    const person = await createPerson(db, userId, 'GF Ajuste Negativo')
    await createCharge(db, userId, person.id, { amount: '500.00', description: 'Dívidas' })
    await createPayment(db, userId, person.id, { amount: '400.00', description: 'Pgto 400' })
    await createAdjustment(db, userId, person.id, { amount: '-100.00', description: 'Abatimento' })

    const { getPersonDebtDetails } = await import('@/lib/queries/debtors')
    const detail = await getPersonDebtDetails(userId, person.id)

    expect(detail.summary.balance).toBe(0)
    expect(detail.summary.chargeCount).toBe(1)
    expect(detail.summary.totalCharged).toBe(500)
    expect(detail.summary.paymentCount).toBe(1)
    expect(detail.summary.totalPaid).toBe(400)
  })

  it('ajuste positivo aumenta o saldo sem virar cobrança', async () => {
    const person = await createPerson(db, userId, 'GF Ajuste Positivo')
    await createCharge(db, userId, person.id, { amount: '500.00', description: 'Dívida' })
    await createAdjustment(db, userId, person.id, { amount: '50.00', description: 'Correção' })

    const { getPersonDebtDetails } = await import('@/lib/queries/debtors')
    const detail = await getPersonDebtDetails(userId, person.id)

    expect(detail.summary.balance).toBe(550)
    expect(detail.summary.chargeCount).toBe(1)
    expect(detail.summary.totalCharged).toBe(500)
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm run test:integration -- debtors.test.ts -t "ajuste negativo"`
Expected: FAIL — `chargeCount` recebido `2` (esperado `1`) e `totalCharged` recebido `400` (esperado `500`), porque o `else` atual conta o ajuste como cobrança. (`balance` já vem `0`.)

- [ ] **Step 4: Corrigir o laço `summary`**

Em `lib/queries/debtors.ts`, o laço em ~L233-244. Substituir:

```ts
  for (const e of entries) {
    if (e.type === 'payment') {
      balance -= e.amount
      totalPaid += e.amount
      paymentCount++
    } else {
      balance += e.amount
      totalCharged += e.amount
      chargeCount++
    }
    if (!lastMovement || e.entryDate > lastMovement) lastMovement = e.entryDate
  }
```

por:

```ts
  for (const e of entries) {
    if (e.type === 'payment') {
      balance -= e.amount
      totalPaid += e.amount
      paymentCount++
    } else if (e.type === 'adjustment') {
      // amount com sinal: negativo reduz o saldo, positivo aumenta.
      // NÃO é cobrança — não pode contaminar totalCharged/chargeCount.
      balance += e.amount
    } else {
      balance += e.amount
      totalCharged += e.amount
      chargeCount++
    }
    if (!lastMovement || e.entryDate > lastMovement) lastMovement = e.entryDate
  }
```

- [ ] **Step 5: Adicionar comentário explícito nos outros dois laços (sem mudar comportamento)**

Em `getPeopleWithBalances` (~L50-54) e no laço `balanceEvolution` (~L251-256), o `else` já soma o ajuste com sinal corretamente. Adicionar um comentário curto acima de cada `else` para deixar explícito:

```ts
    // 'charge' e 'adjustment' (amount com sinal) somam ao saldo aqui
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm run test:integration -- debtors.test.ts -t "ajuste"`
Expected: PASS (ambos os `it`).

- [ ] **Step 7: Commit**

```bash
git add lib/queries/debtors.ts __tests__/integration/debtors.test.ts __tests__/integration/helpers/factories.ts
git commit -m "fix(devedores): ajuste com sinal não contamina contadores de cobrança

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `createDebtPayment` — conciliação gera adjustment atômico

**Files:**
- Modify: `lib/validations/debtors.ts:25-39` (`debtPaymentSchema`)
- Modify: `lib/actions/debtors.ts` (imports; `CreateDebtPaymentInput` ~L172-181; corpo `createDebtPayment` ~L215-242)
- Test: `__tests__/integration/actions-debtors.test.ts`

**Interfaces:**
- Consumes: `db.transaction`, `debtorEntries`, `encryptField`, `decryptField`, `toAmount`, `entryDateToReferenceMonth`, `inArray`.
- Produces: `createDebtPayment(data)` passa a aceitar `reconcileRemainder?: boolean`. Quando `true` + há `settleChargeIds` + `soma(cobranças) − amount > 0`, cria uma entrada `type='adjustment'`, `amount` = `-(diff)`, `settledByPaymentId` = id do pagamento.

- [ ] **Step 1: Adicionar `reconcileRemainder` ao schema**

Em `lib/validations/debtors.ts`, dentro do `.object({...})` do `debtPaymentSchema` (após `settleChargeIds`):

```ts
    settleChargeIds: z.array(uuidSchema).optional(),
    reconcileRemainder: z.boolean().optional(),
    notes: z.string().optional(),
```

- [ ] **Step 2: Adicionar `reconcileRemainder` ao input da action**

Em `lib/actions/debtors.ts`, no type `CreateDebtPaymentInput` (~L172-181), após `settleChargeIds?: string[]`:

```ts
  settleChargeIds?: string[]
  reconcileRemainder?: boolean
  notes?: string
```

- [ ] **Step 3: Garantir imports de leitura no arquivo da action**

Em `lib/actions/debtors.ts`, atualizar a linha de import de crypto e adicionar o de currency:

```ts
import { encryptField, encryptOptional, decryptField } from '@/lib/crypto/fields'
import { toAmount } from '@/lib/utils/currency'
```

(`entryDateToReferenceMonth` e `inArray` já são importados.)

- [ ] **Step 4: Escrever o teste que falha**

Em `__tests__/integration/actions-debtors.test.ts` (o arquivo já mocka `next/cache`, `requireUserId` e `assertOwns*` e importa `createCharge`). Adicionar `createPerson` já está importado. Adicionar o bloco:

```ts
describe('createDebtPayment — conciliação (reconcileRemainder)', () => {
  it('cria payment + adjustment atômicos e zera o saldo', async () => {
    const person = await createPerson(db, userId, 'Concilia OK')
    const c1 = await createCharge(db, userId, person.id, { amount: '300.00', description: 'C1' })
    const c2 = await createCharge(db, userId, person.id, { amount: '200.00', description: 'C2' })

    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await createDebtPayment({
      personId: person.id,
      amount: '400.00',
      description: 'Pagamento parcial',
      entryDate: '2025-04-10',
      createIncome: false,
      settleChargeIds: [c1.id, c2.id],
      reconcileRemainder: true,
    })

    const rows = await db.query.debtorEntries.findMany({
      where: eq(schema.debtorEntries.personId, person.id),
    })
    const payment = rows.find((r) => r.type === 'payment')!
    const adjustment = rows.find((r) => r.type === 'adjustment')!

    expect(adjustment).toBeDefined()
    expect(adjustment.settledByPaymentId).toBe(payment.id)
    expect(adjustment.status).toBeNull()

    const { getPersonDebtDetails } = await import('@/lib/queries/debtors')
    const detail = await getPersonDebtDetails(userId, person.id)
    expect(detail.summary.balance).toBe(0)
    expect(detail.summary.totalPaid).toBe(400)
    expect(detail.summary.chargeCount).toBe(2)
  })

  it('não cria adjustment quando não há underpayment (diff <= 0)', async () => {
    const person = await createPerson(db, userId, 'Sem diff')
    const c1 = await createCharge(db, userId, person.id, { amount: '400.00', description: 'C' })

    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await createDebtPayment({
      personId: person.id,
      amount: '400.00',
      description: 'Pagamento exato',
      entryDate: '2025-04-10',
      createIncome: false,
      settleChargeIds: [c1.id],
      reconcileRemainder: true,
    })

    const rows = await db.query.debtorEntries.findMany({
      where: and(
        eq(schema.debtorEntries.personId, person.id),
        eq(schema.debtorEntries.type, 'adjustment')
      ),
    })
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `npm run test:integration -- actions-debtors.test.ts -t "conciliação"`
Expected: FAIL — `adjustment` é `undefined` (a action ainda não cria a entrada de ajuste).

- [ ] **Step 6: Implementar a conciliação na action**

Em `lib/actions/debtors.ts`, no corpo de `createDebtPayment`, substituir o bloco `if (data.settleChargeIds && data.settleChargeIds.length > 0) {...}` (~L231-242) por:

```ts
    if (data.settleChargeIds && data.settleChargeIds.length > 0) {
      const chargeRows = await tx
        .select({ amount: debtorEntries.amount })
        .from(debtorEntries)
        .where(
          and(
            inArray(debtorEntries.id, data.settleChargeIds),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'charge')
          )
        )
      const chargesTotal = chargeRows.reduce(
        (sum, r) => sum + toAmount(decryptField(r.amount, dek)),
        0
      )

      await tx
        .update(debtorEntries)
        .set({ status: 'settled', settledByPaymentId: paymentEntryId })
        .where(
          and(
            inArray(debtorEntries.id, data.settleChargeIds),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'charge')
          )
        )

      if (data.reconcileRemainder) {
        const diffCents = Math.round((chargesTotal - Number(data.amount)) * 100)
        if (diffCents > 0) {
          const adjustmentAmount = (-diffCents / 100).toFixed(2)
          await tx.insert(debtorEntries).values({
            userId,
            personId: data.personId,
            type: 'adjustment',
            amount: encryptField(adjustmentAmount, dek),
            description: encryptField('Abatimento — conciliação de pagamento', dek),
            entryDate: data.entryDate,
            referenceMonth: data.referenceMonth ?? entryDateToReferenceMonth(data.entryDate),
            status: null,
            settledByPaymentId: paymentEntryId,
          })
        }
      }
    }
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npm run test:integration -- actions-debtors.test.ts -t "conciliação"`
Expected: PASS (ambos os `it`).

- [ ] **Step 8: Commit**

```bash
git add lib/validations/debtors.ts lib/actions/debtors.ts __tests__/integration/actions-debtors.test.ts
git commit -m "feat(devedores): createDebtPayment concilia diferença como abatimento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `deleteDebtEntry` — cascata type-aware (remove ajuste, reabre cobranças)

**Files:**
- Modify: `lib/actions/debtors.ts:355-373` (ramo `entry.type === 'payment'` de `deleteDebtEntry`)
- Test: `__tests__/integration/actions-debtors.test.ts`

**Interfaces:**
- Consumes: `deleteDebtEntry({ id }): Promise<void>` (já existe).
- Produces: ao deletar um pagamento, entradas com `settledByPaymentId = payment.id` são tratadas por tipo — `type='adjustment'` → DELETE; `type='charge'` → `status:'open'`, `settledByPaymentId:null`.

- [ ] **Step 1: Escrever o teste que falha**

Em `__tests__/integration/actions-debtors.test.ts`, adicionar:

```ts
describe('deleteDebtEntry — pagamento com ajuste de conciliação', () => {
  it('deleta o ajuste vinculado e reabre as cobranças', async () => {
    const person = await createPerson(db, userId, 'Del Concilia')
    const c1 = await createCharge(db, userId, person.id, { amount: '300.00', description: 'C1' })
    const c2 = await createCharge(db, userId, person.id, { amount: '200.00', description: 'C2' })

    const { createDebtPayment } = await import('@/lib/actions/debtors')
    await createDebtPayment({
      personId: person.id,
      amount: '400.00',
      description: 'Pagamento parcial',
      entryDate: '2025-05-10',
      createIncome: false,
      settleChargeIds: [c1.id, c2.id],
      reconcileRemainder: true,
    })

    const paymentBefore = await db.query.debtorEntries.findFirst({
      where: and(
        eq(schema.debtorEntries.personId, person.id),
        eq(schema.debtorEntries.type, 'payment')
      ),
    })

    const { deleteDebtEntry } = await import('@/lib/actions/debtors')
    await deleteDebtEntry({ id: paymentBefore!.id })

    const remaining = await db.query.debtorEntries.findMany({
      where: eq(schema.debtorEntries.personId, person.id),
    })
    // sobram só as 2 cobranças, reabertas; nenhum ajuste, nenhum pagamento
    expect(remaining).toHaveLength(2)
    expect(remaining.every((r) => r.type === 'charge')).toBe(true)
    expect(remaining.every((r) => r.status === 'open')).toBe(true)
    expect(remaining.every((r) => r.settledByPaymentId === null)).toBe(true)

    const { getPersonDebtDetails } = await import('@/lib/queries/debtors')
    const detail = await getPersonDebtDetails(userId, person.id)
    expect(detail.summary.balance).toBe(500)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test:integration -- actions-debtors.test.ts -t "pagamento com ajuste"`
Expected: FAIL — `remaining` tem 3 itens (o ajuste órfão fica com `status:'open'` por causa do `UPDATE` genérico atual), e `balance` ≠ 500.

- [ ] **Step 3: Tornar o ramo de payment type-aware**

Em `lib/actions/debtors.ts`, no `deleteDebtEntry`, dentro de `if (entry.type === 'payment') { await db.transaction(async (tx) => {` substituir o `UPDATE` de reabertura (~L359-362) por um DELETE dos ajustes + UPDATE só das cobranças:

```ts
      // Ajustes de conciliação criados junto deste pagamento: deletar.
      await tx
        .delete(debtorEntries)
        .where(
          and(
            eq(debtorEntries.settledByPaymentId, data.id),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'adjustment')
          )
        )

      // Cobranças quitadas por este pagamento: reabrir ANTES de deletar o pagamento
      // (o FK SET NULL limpa settledByPaymentId mas não reseta status).
      await tx
        .update(debtorEntries)
        .set({ status: 'open', settledByPaymentId: null })
        .where(
          and(
            eq(debtorEntries.settledByPaymentId, data.id),
            eq(debtorEntries.userId, userId),
            eq(debtorEntries.type, 'charge')
          )
        )
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test:integration -- actions-debtors.test.ts -t "pagamento com ajuste"`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte de devedores inteira (regressão)**

Run: `npm run test:integration -- actions-debtors.test.ts debtors.test.ts`
Expected: PASS — nenhuma regressão nos testes existentes de `deleteDebtEntry`/`createDebtPayment`.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/debtors.ts __tests__/integration/actions-debtors.test.ts
git commit -m "fix(devedores): deletar pagamento remove ajuste vinculado e reabre cobranças

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `DebtPaymentDialog` — toggle de conciliação

**Files:**
- Modify: `components/devedores/DebtPaymentDialog.tsx`

**Interfaces:**
- Consumes: `createDebtPayment` (agora aceita `reconcileRemainder`), `debtPaymentSchema`, estados já existentes `selectedTotal`, `paymentAmount`, `isOverAmount`.
- Produces: quando `isOverAmount`, mostra o abatimento e um `<Switch>` "Registrar diferença como ajuste (abatimento)"; envia `reconcileRemainder` só quando ligado.

Sem teste automatizado (o projeto não tem test runner de componente; verificação por `typecheck`/`lint`/`build` + checagem manual). Como há várias edições no mesmo arquivo, reescrever o arquivo inteiro com `Write` para não disparar o hook de imports não usados.

- [ ] **Step 1: Adicionar estado `reconcile`**

No corpo do componente, junto dos outros `useState`:

```ts
  const [reconcile, setReconcile] = useState(true)
```

E no `handleOpenChange(false)`, adicionar o reset:

```ts
      setReconcile(true)
```

- [ ] **Step 2: Calcular o valor do abatimento e enviar a flag**

Após a linha `const isExactAmount = ...`, adicionar:

```ts
  const remainder = isOverAmount ? Math.round((selectedTotal - paymentAmount) * 100) / 100 : 0
```

No objeto `data` do `handleSubmit`, após `settleChargeIds: ...`:

```ts
      reconcileRemainder: isOverAmount && reconcile ? true : undefined,
```

- [ ] **Step 3: Renderizar o toggle na área de over-amount**

Substituir o bloco atual do `isOverAmount` (o `<span>Valor selecionado excede o pagamento</span>`) por um bloco que mostra o abatimento e o `Switch`. Dentro do container de resumo das cobranças, quando `isOverAmount`:

```tsx
            {isOverAmount && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <div className="flex items-center justify-between text-caption text-text-secondary">
                  <span>Diferença a conciliar</span>
                  <span className="tabular-nums font-medium text-text-primary">
                    {formatCurrency(remainder)}
                  </span>
                </div>
                <Switch
                  label="Registrar diferença como ajuste (abatimento)"
                  checked={reconcile}
                  onChange={setReconcile}
                />
              </div>
            )}
```

Manter o resumo `{formatCurrency(selectedTotal)} de {formatCurrency(paymentAmount)} selecionado` e o badge `Exato` como estão; o novo bloco entra logo após, condicionado a `isOverAmount`. `Switch` já está importado no arquivo.

- [ ] **Step 4: Verificar typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificação manual (opcional, recomendada)**

`npm run dev`, ir a `/devedores/<id>` de uma pessoa com cobranças abertas, abrir "Pagamento", informar valor menor que a soma das cobranças selecionadas, confirmar que aparece "Diferença a conciliar" + o Switch; registrar e confirmar saldo zerado na página.

- [ ] **Step 6: Commit**

```bash
git add components/devedores/DebtPaymentDialog.tsx
git commit -m "feat(devedores): toggle de conciliação no dialog de pagamento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `DebtEntryList` — renderizar ajuste com valor com sinal

**Files:**
- Modify: `components/devedores/DebtEntryList.tsx`

**Interfaces:**
- Consumes: `DebtEntryDetail` (`type` inclui `'adjustment'`, `amount` pode ser negativo).
- Produces: linha de ajuste com sinal derivado de `entry.amount < 0`, valor em `Math.abs`, cor neutra, ícone e `Badge` "Ajuste". Sem quebrar `netTotal`/filtro (que já tratam ajuste no ramo de não-pagamento).

Sem teste automatizado (verificação por `typecheck`/`lint` + manual). Reescrever o arquivo inteiro com `Write` (múltiplas edições + novo import de ícone).

- [ ] **Step 1: Importar um ícone neutro para ajuste**

No import de `lucide-react` (linha 4), adicionar `Scale`:

```ts
import { CheckCircle, Scale, TrendingDown, TrendingUp } from 'lucide-react'
```

- [ ] **Step 2: Tratar o ícone e o fundo do ajuste no `EntryRow`**

Substituir o bloco do círculo do ícone (~L58-72) para dar tratamento próprio ao ajuste:

```tsx
  const isAdjustment = entry.type === 'adjustment'

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isAdjustment
            ? 'bg-bg-muted'
            : entry.type === 'charge'
              ? 'bg-negative-subtle'
              : 'bg-positive-subtle'
        )}
      >
        {isAdjustment ? (
          <Scale className="h-4 w-4 text-text-secondary" />
        ) : entry.type === 'payment' ? (
          <TrendingUp className="h-4 w-4 text-positive" />
        ) : (
          <TrendingDown className="h-4 w-4 text-negative" />
        )}
      </div>
```

(A variável `isAdjustment` passa a existir logo no início do `return`; declarar antes do `return` junto de `isSettled`/`isOpenCharge`.)

- [ ] **Step 3: Adicionar o badge "Ajuste" na linha de subtítulo**

Dentro do bloco de metadados (o `<div className="flex min-w-0 items-center gap-1.5 ...">`), após o `{formatDate(entry.entryDate)}`, adicionar:

```tsx
          {isAdjustment && (
            <>
              <span className="shrink-0 text-caption text-text-tertiary">·</span>
              <Badge variant="muted" size="sm">
                Ajuste
              </Badge>
            </>
          )}
```

- [ ] **Step 4: Corrigir o valor exibido para não quebrar com sinal negativo**

Substituir o `<span>` do valor (~L122-130):

```tsx
      <span
        className={cn(
          'shrink-0 text-small font-semibold tabular-nums',
          isAdjustment
            ? 'text-text-secondary'
            : entry.type === 'payment'
              ? 'text-positive'
              : 'text-negative'
        )}
      >
        {isAdjustment ? (entry.amount < 0 ? '−' : '+') : entry.type === 'payment' ? '+' : '-'}
        {formatCurrency(Math.abs(entry.amount))}
      </span>
```

- [ ] **Step 5: Verificar typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Verificação manual (opcional)**

Na página do devedor conciliado da Task 4, confirmar que a linha "Abatimento — conciliação de pagamento" aparece com ícone neutro, badge "Ajuste" e valor `−R$ 100,00` em cinza.

- [ ] **Step 7: Commit**

```bash
git add components/devedores/DebtEntryList.tsx
git commit -m "feat(devedores): renderizar lançamento de ajuste com valor com sinal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final

- [ ] `npm run lint && npm run format:check && npm run typecheck && npm test`
- [ ] `npm run test:integration -- debtors.test.ts actions-debtors.test.ts`
- [ ] Fluxo E2E manual: cobranças somando 500 → pagamento de 400 com conciliação ligada → saldo 0; deletar o pagamento → cobranças reabrem, saldo volta a 500.

## Self-Review (feita)

- **Cobertura do spec:** contadores do saldo (Task 1), action de conciliação server-computed (Task 2), cascata de exclusão type-aware (Task 3), UI do toggle (Task 4), UI de renderização do ajuste (Task 5). Fora de escopo confirmado: botão standalone, ajuste de acréscimo pela UI, dívida bidirecional, overpayment.
- **Sem placeholders:** todo passo tem código/comando concreto.
- **Consistência de tipos:** `reconcileRemainder?: boolean` idêntico em schema, `CreateDebtPaymentInput` e dialog; `settledByPaymentId` usado igual em create (set) e delete (filtro por tipo); `getPersonDebtDetails` (nome correto, não `getDebtorDetail`).
