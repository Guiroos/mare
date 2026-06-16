# Fluxo Destino Resgate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `destination='income'` como discriminador de reinvestimento por um novo valor `'reinvest'`, corrigindo o bug onde resgates de emergência tinham `investmentReturnCapital` inflado com o capital total do tipo.

**Architecture:** Adicionar `'reinvest'` ao enum de `destination`; mover o cálculo de `investmentReturnCapital` para ser exclusivo desse novo valor; atualizar a UI para expor exatamente 2 opções (income / reinvest) e exibir hint quando `'reinvest'` estiver selecionado. Registros históricos com `destination='transfer'` continuam funcionando sem alteração.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM (Neon/PostgreSQL), Zod, React state, Vitest (unit + integration)

---

## Estado inicial (working tree em 11/06/2026)

Antes de começar, confirme que os seguintes diffs **já estão no working tree** (não commitados):

- `lib/actions/investments.ts`: bloco `investmentReturnCapital = total_capital` removido de `createWithdrawal`. O arquivo **não** tem o novo bloco `'reinvest'` ainda.
- `components/investimentos/WithdrawalDialog.tsx`: label do `SelectItem value="transfer"` trocado para "Reinvestimento (sem impacto no caixa)" — esta mudança **será revertida** na Task 3.
- `docs/investimentos/README.md`: entrada de status adicionada — manter.

Se o working tree estiver limpo (sem diffs), tudo bem — as tasks abaixo partem do estado commitado.

---

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `lib/validations/investments.ts` | Adicionar `'reinvest'` ao enum |
| `lib/actions/investments.ts` | Lógica `'reinvest'` em `createWithdrawal` e `updateWithdrawal`; type `CreateWithdrawalInput` |
| `components/investimentos/WithdrawalDialog.tsx` | UI com `'reinvest'` + hint; remover `'transfer'` do UI |
| `__tests__/unit/validations-domain.test.ts` | Adicionar caso `destination='reinvest'` |
| `__tests__/integration/actions-investments.test.ts` | Adicionar testes de `createWithdrawal` com `'reinvest'` |

---

## Task 1: Validação — adicionar `'reinvest'` ao enum

**Files:**
- Modify: `lib/validations/investments.ts:54-56`
- Test: `__tests__/unit/validations-domain.test.ts:564-607`

- [ ] **Step 1: Escrever o teste que vai falhar**

Em `__tests__/unit/validations-domain.test.ts`, dentro do `describe('withdrawalSchema')`, adicionar **após** o teste `'accepts destination=transfer'` (linha ~578):

```ts
it('accepts destination=reinvest', () => {
  expect(withdrawalSchema.safeParse({ ...base, destination: 'reinvest' }).success).toBe(true)
})
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```bash
npm test -- --reporter=verbose validations-domain
```

Esperado: FAIL em `accepts destination=reinvest` — `withdrawalSchema` não aceita `'reinvest'` ainda.

- [ ] **Step 3: Atualizar o schema**

Em `lib/validations/investments.ts`, linha 55:

```ts
// Antes
destination: z.enum(['income', 'transfer']),

// Depois
destination: z.enum(['income', 'reinvest', 'transfer']),
```

- [ ] **Step 4: Rodar os testes para confirmar verde**

```bash
npm test -- --reporter=verbose validations-domain
```

Esperado: todos os testes do `describe('withdrawalSchema')` passando.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/investments.ts __tests__/unit/validations-domain.test.ts
git commit -m "feat(investments): add 'reinvest' destination to withdrawalSchema"
```

---

## Task 2: Action `createWithdrawal` — calcular `investmentReturnCapital` para `'reinvest'`

**Files:**
- Modify: `lib/actions/investments.ts:165-211`
- Test: `__tests__/integration/actions-investments.test.ts`

Esta task depende da Task 1 (o schema precisa aceitar `'reinvest'`).

- [ ] **Step 1: Escrever o teste de integração**

Em `__tests__/integration/actions-investments.test.ts`, dentro do `describe('createWithdrawal')`, adicionar após o teste `'destination=transfer não cria income'`:

```ts
it('destination=reinvest cria income com investmentReturnCapital = min(resgate, capital)', async () => {
  const type = await createInvestmentType(db, userId, { name: 'CDB Reinvest' })

  // Criar 2 aportes totalizando R$3.000
  await db.insert(schema.investments).values([
    {
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-01-01',
      amount: '2000.00',
      yieldAmount: null,
      excludeFromCashFlow: false,
    },
    {
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-02-01',
      amount: '1000.00',
      yieldAmount: null,
      excludeFromCashFlow: false,
    },
  ])

  const { createWithdrawal } = await import('@/lib/actions/investments')
  await createWithdrawal({
    investmentTypeId: type.id,
    investmentTypeName: 'CDB Reinvest',
    amount: '3450.00',
    date: '2025-06-01',
    destination: 'reinvest',
  })

  const income = await db.query.incomes.findFirst({
    where: and(eq(schema.incomes.userId, userId), eq(schema.incomes.amount, '3450.00')),
  })

  expect(income).toBeDefined()
  expect(income?.investmentReturnCapital).toBe('3000.00')
})

it('destination=reinvest com resgate menor que capital usa o valor do resgate', async () => {
  const type = await createInvestmentType(db, userId, { name: 'CDB Parcial' })

  await db.insert(schema.investments).values({
    userId,
    investmentTypeId: type.id,
    referenceMonth: '2025-01-01',
    amount: '3000.00',
    yieldAmount: null,
    excludeFromCashFlow: false,
  })

  const { createWithdrawal } = await import('@/lib/actions/investments')
  await createWithdrawal({
    investmentTypeId: type.id,
    investmentTypeName: 'CDB Parcial',
    amount: '50.00',
    date: '2025-06-01',
    destination: 'reinvest',
  })

  const income = await db.query.incomes.findFirst({
    where: and(eq(schema.incomes.userId, userId), eq(schema.incomes.amount, '50.00')),
  })

  expect(income?.investmentReturnCapital).toBe('50.00')
})

it('destination=income NÃO seta investmentReturnCapital (emergência)', async () => {
  const type = await createInvestmentType(db, userId, { name: 'CDB Emergencia' })

  await db.insert(schema.investments).values({
    userId,
    investmentTypeId: type.id,
    referenceMonth: '2025-01-01',
    amount: '3000.00',
    yieldAmount: null,
    excludeFromCashFlow: false,
  })

  const { createWithdrawal } = await import('@/lib/actions/investments')
  await createWithdrawal({
    investmentTypeId: type.id,
    investmentTypeName: 'CDB Emergencia',
    amount: '50.00',
    date: '2025-06-01',
    destination: 'income',
  })

  const income = await db.query.incomes.findFirst({
    where: and(eq(schema.incomes.userId, userId), eq(schema.incomes.amount, '50.00')),
  })

  expect(income?.investmentReturnCapital).toBeNull()
})
```

- [ ] **Step 2: Rodar os testes para confirmar falha**

```bash
npm run test:integration -- --reporter=verbose actions-investments
```

Esperado: os 3 novos testes falham (o `'reinvest'` é rejeitado pelo schema de validação ainda no `createWithdrawal` — que usa `withdrawalSchema.parse`).

- [ ] **Step 3: Atualizar `CreateWithdrawalInput` e `createWithdrawal`**

Em `lib/actions/investments.ts`, trocar o tipo e adicionar a lógica:

```ts
// Tipo atualizado (linha ~165)
export type CreateWithdrawalInput = {
  investmentTypeId: string
  investmentTypeName: string
  amount: string
  date: string
  destination: 'income' | 'reinvest' | 'transfer'
  taxAmount?: string | null
  notes?: string | null
}

// createWithdrawal — substituir o bloco da transaction (linha ~183)
export async function createWithdrawal(data: CreateWithdrawalInput) {
  const userId = await requireUserId()
  withdrawalSchema.parse(data)

  await assertOwnsInvestmentType(userId, data.investmentTypeId)

  let incomeId: string | null = null
  let investmentReturnCapital: string | null = null

  if (data.destination === 'reinvest') {
    const [capitalRow] = await db
      .select({ total: sum(investments.amount) })
      .from(investments)
      .where(
        and(eq(investments.userId, userId), eq(investments.investmentTypeId, data.investmentTypeId))
      )
    investmentReturnCapital = String(
      Math.min(Number(data.amount), Number(capitalRow?.total ?? 0))
    )
  }

  await db.transaction(async (tx) => {
    if (data.destination === 'income' || data.destination === 'reinvest') {
      const [income] = await tx
        .insert(incomes)
        .values({
          userId,
          source: `Resgate investimento ${data.investmentTypeName}`,
          amount: data.amount,
          referenceMonth: dateToReferenceMonth(data.date),
          investmentReturnCapital,
        })
        .returning({ id: incomes.id })
      incomeId = income.id
    }

    await tx.insert(investmentWithdrawals).values({
      userId,
      investmentTypeId: data.investmentTypeId,
      amount: data.amount,
      taxAmount: data.taxAmount || null,
      date: data.date,
      destination: data.destination,
      incomeId,
      notes: data.notes || null,
    })
  })

  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 4: Rodar os testes para confirmar verde**

```bash
npm run test:integration -- --reporter=verbose actions-investments
```

Esperado: todos os testes passando, incluindo os 3 novos.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/investments.ts __tests__/integration/actions-investments.test.ts
git commit -m "feat(investments): compute investmentReturnCapital only for destination=reinvest"
```

---

## Task 3: Action `updateWithdrawal` — recalcular `investmentReturnCapital`

**Files:**
- Modify: `lib/actions/investments.ts:222-260`
- Test: `__tests__/integration/actions-investments.test.ts`

Esta task depende da Task 2.

- [ ] **Step 1: Escrever o teste de integração**

Em `__tests__/integration/actions-investments.test.ts`, adicionar um novo `describe('updateWithdrawal')` após o bloco existente de `createWithdrawal`:

```ts
describe('updateWithdrawal', () => {
  it('destination=reinvest recalcula investmentReturnCapital ao editar amount', async () => {
    const type = await createInvestmentType(db, userId, { name: 'CDB Update' })

    await db.insert(schema.investments).values({
      userId,
      investmentTypeId: type.id,
      referenceMonth: '2025-01-01',
      amount: '3000.00',
      yieldAmount: null,
      excludeFromCashFlow: false,
    })

    const { createWithdrawal, updateWithdrawal } = await import('@/lib/actions/investments')

    await createWithdrawal({
      investmentTypeId: type.id,
      investmentTypeName: 'CDB Update',
      amount: '3450.00',
      date: '2025-06-01',
      destination: 'reinvest',
    })

    const withdrawal = await db.query.investmentWithdrawals.findFirst({
      where: and(
        eq(schema.investmentWithdrawals.userId, userId),
        eq(schema.investmentWithdrawals.investmentTypeId, type.id)
      ),
    })
    expect(withdrawal).toBeDefined()

    // Editar para resgate menor (parcial)
    await updateWithdrawal({
      id: withdrawal!.id,
      investmentTypeId: type.id,
      amount: '200.00',
      date: '2025-06-01',
    })

    const income = await db.query.incomes.findFirst({
      where: eq(schema.incomes.id, withdrawal!.incomeId!),
    })

    // min(200, 3000) = 200
    expect(income?.amount).toBe('200.00')
    expect(income?.investmentReturnCapital).toBe('200.00')
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm run test:integration -- --reporter=verbose actions-investments
```

Esperado: FAIL — `updateWithdrawal` não recalcula `investmentReturnCapital`.

- [ ] **Step 3: Atualizar `updateWithdrawal`**

Em `lib/actions/investments.ts`, substituir o bloco `db.transaction` de `updateWithdrawal`:

```ts
export async function updateWithdrawal(data: UpdateWithdrawalInput) {
  const userId = await requireUserId()
  updateWithdrawalActionSchema.parse(data)

  const [withdrawals] = await Promise.all([
    db.query.investmentWithdrawals.findMany({
      where: and(eq(investmentWithdrawals.id, data.id), eq(investmentWithdrawals.userId, userId)),
      limit: 1,
    }),
    assertOwnsInvestmentType(userId, data.investmentTypeId),
  ])

  const withdrawal = withdrawals[0]
  if (!withdrawal) throw new Error('Resgate não encontrado')

  await db.transaction(async (tx) => {
    await tx
      .update(investmentWithdrawals)
      .set({
        investmentTypeId: data.investmentTypeId,
        amount: data.amount,
        taxAmount: data.taxAmount || null,
        date: data.date,
        notes: data.notes || null,
      })
      .where(and(eq(investmentWithdrawals.id, data.id), eq(investmentWithdrawals.userId, userId)))

    if (withdrawal.incomeId) {
      if (withdrawal.destination === 'reinvest') {
        const [capitalRow] = await tx
          .select({ total: sum(investments.amount) })
          .from(investments)
          .where(
            and(
              eq(investments.userId, userId),
              eq(investments.investmentTypeId, data.investmentTypeId)
            )
          )
        const newReturnCapital = String(
          Math.min(Number(data.amount), Number(capitalRow?.total ?? 0))
        )
        await tx
          .update(incomes)
          .set({
            amount: data.amount,
            referenceMonth: dateToReferenceMonth(data.date),
            investmentReturnCapital: newReturnCapital,
          })
          .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)))
      } else {
        await tx
          .update(incomes)
          .set({ amount: data.amount, referenceMonth: dateToReferenceMonth(data.date) })
          .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)))
      }
    }
  })

  revalidatePath('/investimentos')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 4: Rodar os testes para confirmar verde**

```bash
npm run test:integration -- --reporter=verbose actions-investments
```

Esperado: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/investments.ts __tests__/integration/actions-investments.test.ts
git commit -m "fix(investments): recalculate investmentReturnCapital on updateWithdrawal for reinvest"
```

---

## Task 4: UI — `WithdrawalDialog` com opção `reinvest` e hint

**Files:**
- Modify: `components/investimentos/WithdrawalDialog.tsx`

Esta task não depende das anteriores em runtime, mas deve ser feita após a Task 1 para que o type do estado fique consistente com o schema.

- [ ] **Step 1: Atualizar o componente**

Aplicar todas as mudanças de uma vez usando Write (o componente tem estado interdependente — mais seguro que múltiplos Edit):

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createWithdrawal } from '@/lib/actions/investments'
import { withdrawalSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props = {
  investmentTypes: { id: string; name: string }[]
  initialTypeId?: string
  initialAmount?: number
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function WithdrawalDialog({
  investmentTypes,
  initialTypeId,
  initialAmount,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [destination, setDestination] = useState<'income' | 'reinvest'>('income')
  const [typeId, setTypeId] = useState(initialTypeId ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasTax, setHasTax] = useState(false)
  const [grossCents, setGrossCents] = useState(() =>
    initialAmount ? Math.round(initialAmount * 100) : 0
  )
  const [taxCents, setTaxCents] = useState(0)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen

  const netCents = grossCents - taxCents
  const netAmount = netCents / 100

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setErrors({})
      setHasTax(false)
      setGrossCents(0)
      setTaxCents(0)
      if (!initialTypeId) setTypeId('')
      setDestination('income')
    }
    if (isControlled) {
      controlledOnOpenChange?.(v)
    } else {
      setInternalOpen(v)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const result = withdrawalSchema.safeParse({
      investmentTypeId: typeId,
      amount: (fd.get('amount') as string).trim(),
      date: (fd.get('date') as string).trim(),
      destination,
      taxAmount: hasTax ? (fd.get('taxAmount') as string) || null : null,
    })

    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        const typeName =
          investmentTypes.find((t) => t.id === result.data.investmentTypeId)?.name ?? ''
        await createWithdrawal({
          investmentTypeId: result.data.investmentTypeId,
          investmentTypeName: typeName,
          amount: result.data.amount,
          date: result.data.date,
          destination: result.data.destination,
          taxAmount: result.data.taxAmount ?? null,
          notes: (fd.get('notes') as string).trim() || null,
        })
        handleOpenChange(false)
      } catch {
        toast.error('Erro ao registrar resgate.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Tipo de investimento" error={errors.investmentTypeId}>
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {investmentTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Houve desconto de imposto?">
        <Switch label="Sim, houve IR ou IOF" checked={hasTax} onChange={setHasTax} />
      </Field>

      {hasTax ? (
        <>
          <Field label="Valor bruto (R$)" error={errors.amount}>
            <CurrencyInput
              name="_gross"
              onValueChange={setGrossCents}
              error={!!errors.amount}
              required
            />
          </Field>
          <Field label="Imposto (IR/IOF) (R$)">
            <CurrencyInput name="_tax" onValueChange={setTaxCents} />
          </Field>
          <p className="text-caption text-text-secondary">
            Valor líquido:{' '}
            <strong className="font-semibold tabular-nums text-text-primary">
              {formatCurrency(netAmount > 0 ? netAmount : 0)}
            </strong>
          </p>
          <input
            type="hidden"
            name="amount"
            value={netCents > 0 ? (netCents / 100).toFixed(2) : ''}
          />
          <input type="hidden" name="taxAmount" value={(taxCents / 100).toFixed(2)} />
        </>
      ) : (
        <Field label="Valor recebido (R$)" error={errors.amount}>
          <CurrencyInput
            name="amount"
            defaultValue={initialAmount}
            error={!!errors.amount}
            required
          />
        </Field>
      )}

      <Field label="Data do resgate" error={errors.date}>
        <Input name="date" type="date" error={!!errors.date} required />
      </Field>

      <Field label="Destino">
        <Select
          value={destination}
          onValueChange={(v) => setDestination(v as 'income' | 'reinvest')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Caixa (uso pessoal / emergência)</SelectItem>
            <SelectItem value="reinvest">Reinvestimento (mostrar só rendimento)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {destination === 'reinvest' && (
        <p className="text-caption text-text-secondary">
          Ao criar o novo aporte, marque{' '}
          <strong className="font-medium text-text-primary">&quot;Já tinha o valor&quot;</strong>{' '}
          para que o capital não seja contabilizado como saída do caixa novamente.
        </p>
      )}

      <Field label="Observações" hint="Opcional">
        <Input name="notes" />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Registrar'}
      </Button>
    </form>
  )

  return (
    <>
      {!isControlled && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setInternalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Registrar resgate</span>
        </Button>
      )}

      {isDesktop ? (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar resgate</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Registrar resgate</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">{form}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verificar typecheck e lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sem erros. Atenção: o type de `destination` no state agora é `'income' | 'reinvest'` — o `handleSubmit` passa para `createWithdrawal` que aceita `'income' | 'reinvest' | 'transfer'`, compatível.

- [ ] **Step 3: Commit**

```bash
git add components/investimentos/WithdrawalDialog.tsx
git commit -m "feat(investments): update WithdrawalDialog to use reinvest destination with hint"
```

---

## Task 5: Verificação final e suite completa

- [ ] **Step 1: Rodar suite completa**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```

Esperado: todos os testes passando, lint e typecheck limpos.

- [ ] **Step 2: Atualizar status do doc de spec**

Em `docs/investimentos/09-fluxo-destino-resgate.md`, alterar a linha de status (linha 3):

```md
> **Status: implementado** (junho/2026)
```

- [ ] **Step 3: Commit final**

```bash
git add docs/investimentos/09-fluxo-destino-resgate.md
git commit -m "docs(investments): mark 09-fluxo-destino-resgate as implemented"
```

---

## Critérios de Aceite (do spec)

- [ ] Resgate de emergência (R$50 de tipo com R$3.000 aportado): income aparece como +R$50, `investmentReturnCapital = null`
- [ ] Resgate de reinvestimento (R$3.450 de tipo com R$3.000 aportado): `investmentReturnCapital = 3000.00`, income líquido no dashboard = R$450
- [ ] Editar amount de resgate `'reinvest'`: `investmentReturnCapital` é recalculado; nunca fica negativo
- [ ] Registros com `destination='transfer'` existentes continuam sem income e sem impacto
- [ ] Select do formulário exibe exatamente 2 opções; `'transfer'` não aparece
- [ ] Hint sobre `excludeFromCashFlow` é visível quando `'reinvest'` está selecionado
