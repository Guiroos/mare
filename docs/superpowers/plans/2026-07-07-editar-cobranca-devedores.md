# Editar cobrança em aberto (devedores) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ação "Editar" a cobranças em aberto no detalhe de um devedor, permitindo trocar descrição, data e observações (valor imutável).

**Architecture:** Nova action `updateDebtCharge` com guard de escopo no servidor + schema Zod sem `amount`; novo dialog responsivo `EditChargeDialog` no molde do `SettleChargeDialog`; fiação em `DebtEntryList` no ramo `isOpenCharge` do `RowActions`. Sem mudança de schema, sem migration.

**Tech Stack:** Next.js 14 App Router, Drizzle (Neon Postgres), Zod, criptografia MEK/DEK por usuário, Vitest (integração com banco real via neon-testing), DS Maré.

## Global Constraints

- Toda action com mutação segue: `requireUserId()` → `schema.parse` → `assertOwns*` → DB → `revalidatePath`. `requireUserId` sempre importado de `@/lib/auth/require-user`.
- Campos sensíveis (`description`, `notes`) cifrados via DEK: `encryptField` / `encryptOptional` de `@/lib/crypto/fields`. Nunca gravar plaintext.
- `entryDate` é `YYYY-MM-DD`; `referenceMonth` é `YYYY-MM-01`. Recalcular sempre com `entryDateToReferenceMonth(entryDate)` (helper local em `lib/actions/debtors.ts`: `entryDate.slice(0, 7) + '-01'`).
- Dialogs de mutação: fechar só no `try`, nunca no `catch`; "Cancelar" chama `handleOpenChange(false)`.
- Responsivo: `Dialog` desktop (`min-width: 1024px` via `useMediaQuery`) + `Drawer` mobile; `DrawerContent` precisa de wrapper `<div className="px-4 pb-6">`.
- Versões de pacote fixas (`--save-exact`); não instalar nada novo (nenhum pacote é necessário aqui).
- Antes de finalizar: `npm run lint && npm run format:check && npm run typecheck && npm test`. Integração: `npm run test:integration` (requer envs Neon + `ENCRYPTION_MASTER_KEY`).
- Hook `PostToolUse:Edit` bloqueia imports não usados — ao fazer múltiplas mudanças num arquivo de componente, preferir `Write` do arquivo inteiro.

---

### Task 1: Schema + action `updateDebtCharge`

**Files:**
- Modify: `lib/validations/debtors.ts` (adicionar `updateDebtChargeSchema` após `debtChargeFromTransactionSchema`)
- Modify: `lib/actions/debtors.ts` (adicionar `UpdateDebtChargeInput` + `updateDebtCharge` após `createDebtChargeFromTransaction`, ~linha 175; adicionar `updateDebtChargeSchema` ao import de `@/lib/validations/debtors`)
- Test: `__tests__/integration/debtors.test.ts` (adicionar mocks de topo de arquivo + `describe('updateDebtCharge')`)

**Interfaces:**
- Consumes: `requireUserId` (`@/lib/auth/require-user`), `assertOwnsDebtEntry(userId: string, entryId: string): Promise<void>` (`@/lib/auth/ownership`), `getDekForUser` (`@/lib/crypto/keys`), `encryptField`/`encryptOptional` (`@/lib/crypto/fields`), `entryDateToReferenceMonth` (local em `debtors.ts`).
- Produces:
  ```ts
  export type UpdateDebtChargeInput = {
    id: string
    description: string
    entryDate: string
    notes?: string
  }
  export async function updateDebtCharge(data: UpdateDebtChargeInput): Promise<void>
  ```

- [ ] **Step 1: Adicionar o schema de validação**

Em `lib/validations/debtors.ts`, após `debtChargeFromTransactionSchema` (que termina em `})`), adicionar:

```ts
export const updateDebtChargeSchema = z.object({
  id: uuidSchema,
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  entryDate: dateSchema,
  notes: z.string().optional(),
})
```

(`uuidSchema`, `dateSchema` e `z` já estão importados no arquivo — confirmar no topo; não adicionar imports duplicados.)

- [ ] **Step 2: Escrever o teste de integração que falha**

No topo de `__tests__/integration/debtors.test.ts`, ANTES de `neonTestingSetup()`, adicionar os mocks hoisted (o arquivo ainda não os tem):

```ts
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))
vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsPerson: vi.fn(),
  assertOwnsDebtEntry: vi.fn(),
}))
```

Dentro do `beforeAll` existente, ao final, configurar os mocks resolvidos (dynamic import após o neon-testing setar `DATABASE_URL`):

```ts
  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
  const { assertOwnsDebtEntry } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsDebtEntry).mockResolvedValue(undefined)
```

Adicionar, ao final do arquivo, o bloco de teste:

```ts
describe('updateDebtCharge', () => {
  it('atualiza descrição, data e recalcula referenceMonth ao mudar de mês', async () => {
    const charge = await createCharge(db, userId, personId, {
      description: 'Almoço',
      entryDate: '2025-01-10',
      referenceMonth: '2025-01-01',
    })

    const { updateDebtCharge } = await import('@/lib/actions/debtors')
    await updateDebtCharge({
      id: charge.id,
      description: 'Almoço editado',
      entryDate: '2025-02-15',
      notes: 'movido um mês',
    })

    const row = await db.query.debtorEntries.findFirst({
      where: eq(schema.debtorEntries.id, charge.id),
    })
    expect(row?.entryDate).toBe('2025-02-15')
    expect(row?.referenceMonth).toBe('2025-02-01')

    const { getDekForUser } = await import('@/lib/crypto/keys')
    const { decryptField, decryptOptional } = await import('@/lib/crypto/fields')
    const dek = await getDekForUser(userId)
    expect(decryptField(row!.description, dek)).toBe('Almoço editado')
    expect(decryptOptional(row!.notes, dek)).toBe('movido um mês')
  })

  it('rejeita edição de lançamento que não é cobrança aberta', async () => {
    const payment = await createPayment(db, userId, personId)

    const { updateDebtCharge } = await import('@/lib/actions/debtors')
    await expect(
      updateDebtCharge({ id: payment.id, description: 'x', entryDate: '2025-01-10' })
    ).rejects.toThrow('Só é possível editar cobranças em aberto')
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm run test:integration -- -t updateDebtCharge`
Expected: FAIL — `updateDebtCharge` não existe em `@/lib/actions/debtors` (erro de import/undefined).

- [ ] **Step 4: Implementar a action**

Em `lib/actions/debtors.ts`, adicionar `updateDebtChargeSchema` ao import existente de `@/lib/validations/debtors` (junto de `debtChargeSchema`, `debtChargeFromTransactionSchema`, etc.). Depois, após a função `createDebtChargeFromTransaction`, adicionar:

```ts
export type UpdateDebtChargeInput = {
  id: string
  description: string
  entryDate: string
  notes?: string
}

export async function updateDebtCharge(data: UpdateDebtChargeInput) {
  const userId = await requireUserId()
  updateDebtChargeSchema.parse(data)
  await assertOwnsDebtEntry(userId, data.id)

  const entry = await db.query.debtorEntries.findFirst({
    where: and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)),
    columns: { type: true, status: true, personId: true },
  })

  if (!entry) throw new Error('Lançamento não encontrado')
  if (entry.type !== 'charge' || (entry.status !== 'open' && entry.status !== null)) {
    throw new Error('Só é possível editar cobranças em aberto')
  }

  const dek = await getDekForUser(userId)

  await db
    .update(debtorEntries)
    .set({
      description: encryptField(data.description.trim(), dek),
      entryDate: data.entryDate,
      referenceMonth: entryDateToReferenceMonth(data.entryDate),
      notes: encryptOptional(data.notes?.trim() || null, dek),
      updatedAt: new Date(),
    })
    .where(and(eq(debtorEntries.id, data.id), eq(debtorEntries.userId, userId)))

  revalidatePath('/devedores')
  revalidatePath(`/devedores/${entry.personId}`)
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm run test:integration -- -t updateDebtCharge`
Expected: PASS (2 testes).

- [ ] **Step 6: Verificar lint/format/typecheck**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: sem erros. Se `format:check` reclamar, rodar `npx prettier --write lib/validations/debtors.ts lib/actions/debtors.ts __tests__/integration/debtors.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add lib/validations/debtors.ts lib/actions/debtors.ts __tests__/integration/debtors.test.ts
git commit -m "feat(devedores): action updateDebtCharge para editar cobrança em aberto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `EditChargeDialog` + fiação em `DebtEntryList`

**Files:**
- Create: `components/devedores/EditChargeDialog.tsx`
- Modify: `components/devedores/DebtEntryList.tsx` (import do dialog; state `editEntry`; prop `onEdit` em `EntryRow`; `onEdit` no `RowActions` do ramo `isOpenCharge`; render do dialog)

**Interfaces:**
- Consumes: `updateDebtCharge`, `UpdateDebtChargeInput` (`@/lib/actions/debtors`), `updateDebtChargeSchema` (`@/lib/validations/debtors`), `DebtEntryDetail` (`@/lib/queries/debtors`), `formatZodErrors` (`@/lib/validations/utils`), `useMediaQuery` (`@/hooks/use-media-query`), primitivos DS (`Button`, `Field`, `Input`, `Textarea`, `Dialog*`, `Drawer*`).
- Produces:
  ```tsx
  export function EditChargeDialog(props: {
    entry: DebtEntryDetail
    open: boolean
    onOpenChange: (v: boolean) => void
  }): JSX.Element
  ```

- [ ] **Step 1: Criar o componente `EditChargeDialog`**

Criar `components/devedores/EditChargeDialog.tsx` com o conteúdo completo:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { updateDebtCharge } from '@/lib/actions/debtors'
import { updateDebtChargeSchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from 'sonner'

type Props = {
  entry: DebtEntryDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function EditChargeDialog({ entry, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      id: entry.id,
      description: (fd.get('description') as string).trim(),
      entryDate: fd.get('entryDate') as string,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    const result = updateDebtChargeSchema.safeParse(data)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await updateDebtCharge(result.data)
        toast.success('Cobrança atualizada.')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao editar cobrança.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Valor">
        <p className="flex h-12 items-center text-body font-semibold tabular-nums text-text-primary">
          {formatCurrency(entry.amount)}
        </p>
      </Field>

      <Field label="Descrição" required error={errors.description}>
        <Input
          name="description"
          defaultValue={entry.description}
          error={!!errors.description}
          autoFocus
          required
        />
      </Field>

      <Field label="Data" required error={errors.entryDate}>
        <Input
          name="entryDate"
          type="date"
          defaultValue={entry.entryDate}
          error={!!errors.entryDate}
          required
        />
      </Field>

      <Field label="Observações" error={errors.notes}>
        <Textarea
          name="notes"
          defaultValue={entry.notes ?? ''}
          placeholder="Informações adicionais..."
          rows={2}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="md" onClick={() => handleOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? '...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar cobrança</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Editar cobrança</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 2: Fiar o dialog em `DebtEntryList.tsx`**

Fazer as 5 mudanças abaixo (usar `Write` do arquivo inteiro se o hook de imports bloquear edits parciais):

1. Import após os outros imports de `./`:
```tsx
import { EditChargeDialog } from './EditChargeDialog'
```

2. Na assinatura de `EntryRow`, adicionar o callback `onEdit` (junto de `onSettle`):
```tsx
  onEdit,
}: {
  entry: DebtEntryDetail
  onDeleteWithIncome: (entry: DebtEntryDetail) => void
  onDeleteWithSettled: (entry: DebtEntryDetail) => void
  onSettle: (entry: DebtEntryDetail) => void
  onEdit: (entry: DebtEntryDetail) => void
}) {
```

3. No ramo `isOpenCharge` do `RowActions`, adicionar `onEdit`:
```tsx
      ) : isOpenCharge ? (
        <RowActions
          onEdit={() => onEdit(entry)}
          additionalActions={[
            {
              label: 'Quitar',
              icon: CheckCircle,
              onClick: () => onSettle(entry),
            },
          ]}
          onDelete={async () => {
            await deleteDebtEntry({ id: entry.id })
            toast.success('Lançamento excluído.')
          }}
          deleteTitle="Excluir lançamento"
          deleteDescription={`Excluir "${entry.description}"? O saldo da pessoa será recalculado.`}
        />
```

4. No componente `DebtEntryList`, adicionar o state (junto dos outros `useState`):
```tsx
  const [editEntry, setEditEntry] = useState<DebtEntryDetail | null>(null)
```
E passar `onEdit={setEditEntry}` em cada `<EntryRow ... />`:
```tsx
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onDeleteWithIncome={setDialogEntry}
                  onDeleteWithSettled={setSettledDeleteEntry}
                  onSettle={setSettleEntry}
                  onEdit={setEditEntry}
                />
```

5. Render do dialog junto dos outros (após o bloco `settleEntry`):
```tsx
      {editEntry && (
        <EditChargeDialog
          entry={editEntry}
          open={!!editEntry}
          onOpenChange={(v) => {
            if (!v) setEditEntry(null)
          }}
        />
      )}
```

- [ ] **Step 3: Verificar lint/format/typecheck**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: sem erros. Ajustar com `npx prettier --write components/devedores/EditChargeDialog.tsx components/devedores/DebtEntryList.tsx` se necessário.

- [ ] **Step 4: Revisão do DS**

Rodar o agente `ds-reviewer` sobre `components/devedores/EditChargeDialog.tsx` e `components/devedores/DebtEntryList.tsx`. Corrigir eventuais violações de token/regra apontadas.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build de produção sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/devedores/EditChargeDialog.tsx components/devedores/DebtEntryList.tsx
git commit -m "feat(devedores): dialog de editar cobrança em aberto na lista de lançamentos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Escopo (só cobrança aberta) → Task 1 guard no servidor + Task 2 wiring apenas em `isOpenCharge`. ✓
- Campos descrição/data/notes, valor imutável → schema sem `amount` (Task 1) + form sem campo de valor (Task 2, valor exibido read-only). ✓
- Recálculo de `referenceMonth` → Task 1 Step 4 + teste Step 2. ✓
- Sem migration → nenhuma mudança de schema. ✓
- Componente no molde do `SettleChargeDialog`, responsivo → Task 2 Step 1. ✓
- Testes de integração (happy path, recálculo de mês, rejeição de não-cobrança-aberta, ownership) → Task 1 Step 2. Ownership coberto implicitamente (mock `assertOwnsDebtEntry` resolvido); a chamada real é garantida pelo padrão da action. ✓

**Placeholder scan:** nenhum TODO/TBD; todo código presente. ✓

**Type consistency:** `updateDebtCharge`/`UpdateDebtChargeInput` idênticos entre Task 1 (produz) e Task 2 (consome); `EditChargeDialog` props batem com o render em `DebtEntryList`. ✓
