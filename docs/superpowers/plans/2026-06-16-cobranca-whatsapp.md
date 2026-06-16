# Cobrança via WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar "Cobrar via WhatsApp" no kebab de Devedores — abre dialog com cobranças em aberto pré-selecionadas, preview da mensagem com chave Pix e botão para abrir o WhatsApp (ou copiar mensagem se não houver telefone).

**Architecture:** Pix key armazenada em `userSettings.pixKey`. Dois novos utilitários puros (`phone.ts`, `debtMessage.ts`) com unit tests. Dois novos componentes client (`PixKeyCard`, `CobrancaDialog`). Integração via `additionalActions` do `RowActions` existente nas páginas de lista e detalhe.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM (Neon), Vitest, Radix Dialog/vaul Drawer, Tailwind DS Maré.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/db/schema.ts` | editar | add `pixKey` em `userSettings` |
| `lib/db/migrations/` | gerar | drizzle-kit generate + migrate |
| `lib/utils/phone.ts` | criar | `formatPhoneForWhatsApp` |
| `lib/utils/debtMessage.ts` | criar | `buildDebtMessage`, `ChargeForMessage` |
| `lib/queries/settings.ts` | editar | add `getUserPixKey` |
| `lib/actions/settings.ts` | editar | add `updatePixKey` |
| `lib/queries/debtors.ts` | editar | add `getOpenChargesForPeople` |
| `components/devedores/PixKeyCard.tsx` | criar | card + inline dialog para editar chave Pix |
| `components/devedores/CobrancaDialog.tsx` | criar | Dialog/Drawer com checklist + preview + ação |
| `components/devedores/DevedorDetailActions.tsx` | criar | client wrapper para header da página de detalhe |
| `components/devedores/DebtorList.tsx` | editar | add CobrancaDialog + additionalAction no kebab |
| `app/(app)/devedores/page.tsx` | editar | buscar pixKey + openChargesByPerson; render PixKeyCard |
| `app/(app)/devedores/[id]/page.tsx` | editar | buscar pixKey + render DevedorDetailActions |
| `__tests__/unit/phone.test.ts` | criar | testes para `formatPhoneForWhatsApp` |
| `__tests__/unit/debtMessage.test.ts` | criar | testes para `buildDebtMessage` |

---

## Task 1: Schema — add pixKey to userSettings

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Adicionar coluna `pixKey` em `userSettings`**

Em `lib/db/schema.ts`, na definição de `userSettings` (linha ~25), adicionar após `autoRolloverFixedExpenses`:

```ts
pixKey: varchar('pix_key', { length: 100 }),
```

O bloco completo fica:
```ts
export const userSettings = pgTable(
  'user_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    creditMode: varchar('credit_mode', { length: 20 }).notNull().default('accrual'),
    faturaActiveFrom: date('fatura_active_from'),
    autoRolloverFixedExpenses: boolean('auto_rollover_fixed_expenses').notNull().default(false),
    pixKey: varchar('pix_key', { length: 100 }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('user_settings_user_idx').on(t.userId)]
)
```

- [ ] **Gerar migration**

```bash
npm run db:generate
```

Verificar que o arquivo gerado em `lib/db/migrations/` contém `ALTER TABLE "user_settings" ADD COLUMN "pix_key" varchar(100)`.

- [ ] **Formatar migration (pre-push hook rejeita formatação do drizzle-kit)**

```bash
npx prettier --write lib/db/migrations/meta/
```

- [ ] **Aplicar migration**

```bash
npm run db:migrate
```

- [ ] **Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "feat(schema): add pixKey to userSettings"
```

---

## Task 2: Phone util + testes

**Files:**
- Create: `lib/utils/phone.ts`
- Create: `__tests__/unit/phone.test.ts`

- [ ] **Escrever o teste falho**

Criar `__tests__/unit/phone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatPhoneForWhatsApp } from '@/lib/utils/phone'

describe('formatPhoneForWhatsApp', () => {
  it('strips non-digits and prepends 55', () => {
    expect(formatPhoneForWhatsApp('(11) 99999-9999')).toBe('5511999999999')
  })

  it('keeps number that already starts with 55', () => {
    expect(formatPhoneForWhatsApp('+55 (11) 99999-9999')).toBe('5511999999999')
  })

  it('replaces leading 0 with 55', () => {
    expect(formatPhoneForWhatsApp('011 99999-9999')).toBe('5511999999999')
  })

  it('handles already clean international number', () => {
    expect(formatPhoneForWhatsApp('5511987654321')).toBe('5511987654321')
  })

  it('handles number with spaces and dashes', () => {
    expect(formatPhoneForWhatsApp('11 9 8765-4321')).toBe('5511987654321')
  })
})
```

- [ ] **Rodar teste para confirmar falha**

```bash
npm test -- phone.test.ts
```

Esperado: FAIL com "Cannot find module '@/lib/utils/phone'"

- [ ] **Implementar `formatPhoneForWhatsApp`**

Criar `lib/utils/phone.ts`:

```ts
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55')) return digits
  if (digits.startsWith('0')) return '55' + digits.slice(1)
  return '55' + digits
}
```

- [ ] **Rodar testes para confirmar aprovação**

```bash
npm test -- phone.test.ts
```

Esperado: 5 passing

- [ ] **Commit**

```bash
git add lib/utils/phone.ts __tests__/unit/phone.test.ts
git commit -m "feat(utils): add formatPhoneForWhatsApp"
```

---

## Task 3: Message builder util + testes

**Files:**
- Create: `lib/utils/debtMessage.ts`
- Create: `__tests__/unit/debtMessage.test.ts`

- [ ] **Escrever o teste falho**

Criar `__tests__/unit/debtMessage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDebtMessage } from '@/lib/utils/debtMessage'

const charges = [
  { description: 'Almoço', entryDate: '2026-05-15', amount: 80 },
  { description: 'Cinema', entryDate: '2026-05-20', amount: 40 },
]

describe('buildDebtMessage', () => {
  it('includes greeting with person name', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('Olá João! 👋')
  })

  it('formats date as DD/MM/AAAA', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('15/05/2026')
    expect(msg).toContain('20/05/2026')
  })

  it('includes description for each charge', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('Almoço')
    expect(msg).toContain('Cinema')
  })

  it('includes bullet points', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('• Almoço')
    expect(msg).toContain('• Cinema')
  })

  it('includes formatted total', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('120,00')
  })

  it('includes pix key when provided', () => {
    const msg = buildDebtMessage('João', charges, 'joao@email.com')
    expect(msg).toContain('Minha chave Pix: joao@email.com')
  })

  it('omits pix line when pixKey is null', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).not.toContain('Pix')
  })

  it('handles empty charges list', () => {
    const msg = buildDebtMessage('Maria', [], null)
    expect(msg).toContain('Olá Maria! 👋')
    expect(msg).toContain('Total:')
    expect(msg).toContain('0,00')
  })
})
```

- [ ] **Rodar teste para confirmar falha**

```bash
npm test -- debtMessage.test.ts
```

Esperado: FAIL com "Cannot find module '@/lib/utils/debtMessage'"

- [ ] **Implementar `buildDebtMessage`**

Criar `lib/utils/debtMessage.ts`:

```ts
import { formatCurrency } from '@/lib/utils/currency'

export type ChargeForMessage = {
  description: string
  entryDate: string
  amount: number
}

export function buildDebtMessage(
  name: string,
  charges: ChargeForMessage[],
  pixKey: string | null
): string {
  const lines: string[] = [
    `Olá ${name}! 👋`,
    '',
    'Passando para lembrar dos valores em aberto:',
    '',
  ]

  let total = 0
  for (const charge of charges) {
    const [year, month, day] = charge.entryDate.split('-')
    lines.push(`• ${charge.description} (${day}/${month}/${year}) — ${formatCurrency(charge.amount)}`)
    total += charge.amount
  }

  lines.push('', `Total: ${formatCurrency(total)}`)

  if (pixKey) {
    lines.push('', `Minha chave Pix: ${pixKey}`)
  }

  return lines.join('\n')
}
```

- [ ] **Rodar testes para confirmar aprovação**

```bash
npm test -- debtMessage.test.ts
```

Esperado: 8 passing

- [ ] **Commit**

```bash
git add lib/utils/debtMessage.ts __tests__/unit/debtMessage.test.ts
git commit -m "feat(utils): add buildDebtMessage for WhatsApp template"
```

---

## Task 4: getUserPixKey + updatePixKey

**Files:**
- Modify: `lib/queries/settings.ts`
- Modify: `lib/actions/settings.ts`

- [ ] **Adicionar `getUserPixKey` em `lib/queries/settings.ts`**

```ts
export async function getUserPixKey(userId: string): Promise<string | null> {
  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { pixKey: true },
  })
  return row?.pixKey ?? null
}
```

- [ ] **Adicionar `updatePixKey` em `lib/actions/settings.ts`**

```ts
export async function updatePixKey(pixKey: string | null) {
  const userId = await requireUserId()

  await db
    .insert(userSettings)
    .values({ userId, pixKey })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { pixKey, updatedAt: new Date() },
    })

  revalidatePath('/devedores')
}
```

- [ ] **Rodar typecheck**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros relacionados a esses arquivos.

- [ ] **Commit**

```bash
git add lib/queries/settings.ts lib/actions/settings.ts
git commit -m "feat(settings): add getUserPixKey and updatePixKey"
```

---

## Task 5: getOpenChargesForPeople (batch query)

**Files:**
- Modify: `lib/queries/debtors.ts`

- [ ] **Adicionar `getOpenChargesForPeople` em `lib/queries/debtors.ts`**

Logo após `getOpenChargesForPerson`, adicionar:

```ts
export async function getOpenChargesForPeople(
  userId: string,
  personIds: string[]
): Promise<Record<string, OpenChargeForLinking[]>> {
  if (personIds.length === 0) return {}

  const rows = await db
    .select({
      id: debtorEntries.id,
      personId: debtorEntries.personId,
      description: debtorEntries.description,
      amount: debtorEntries.amount,
      entryDate: debtorEntries.entryDate,
    })
    .from(debtorEntries)
    .where(
      and(
        eq(debtorEntries.userId, userId),
        inArray(debtorEntries.personId, personIds),
        eq(debtorEntries.type, 'charge'),
        or(eq(debtorEntries.status, 'open'), isNull(debtorEntries.status))
      )
    )
    .orderBy(asc(debtorEntries.entryDate))

  const result: Record<string, OpenChargeForLinking[]> = {}
  for (const row of rows) {
    if (!result[row.personId]) result[row.personId] = []
    result[row.personId].push({
      id: row.id,
      description: row.description,
      amount: toAmount(row.amount),
      entryDate: row.entryDate,
    })
  }
  return result
}
```

- [ ] **Rodar typecheck**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add lib/queries/debtors.ts
git commit -m "feat(queries): add getOpenChargesForPeople batch query"
```

---

## Task 6: PixKeyCard component

**Files:**
- Create: `components/devedores/PixKeyCard.tsx`

- [ ] **Criar `PixKeyCard`**

Criar `components/devedores/PixKeyCard.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { updatePixKey } from '@/lib/actions/settings'
import { cn } from '@/lib/utils/cn'

interface PixKeyCardProps {
  pixKey: string | null
}

function PixKeyForm({ pixKey, onClose }: { pixKey: string | null; onClose: () => void }) {
  const [value, setValue] = useState(pixKey ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await updatePixKey(value.trim() || null)
        toast.success('Chave Pix salva.')
        onClose()
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Chave Pix" hint="CPF, e-mail, telefone ou chave aleatória">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sua@chave.pix"
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

export function PixKeyCard({ pixKey }: PixKeyCardProps) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const title = pixKey ? 'Editar chave Pix' : 'Cadastrar chave Pix'
  const form = <PixKeyForm pixKey={pixKey} onClose={() => setOpen(false)} />

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border p-3',
          pixKey ? 'bg-bg-surface' : 'border-dashed bg-bg-subtle'
        )}
      >
        <div className="min-w-0">
          <p className="text-caption font-medium text-text-tertiary">Sua chave Pix</p>
          <p
            className={cn(
              'mt-0.5 truncate text-body',
              pixKey ? 'font-medium text-text-primary' : 'text-text-tertiary'
            )}
          >
            {pixKey ?? 'Não cadastrada'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
          {pixKey ? 'Editar' : '+ Cadastrar'}
        </Button>
      </div>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">{form}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
```

- [ ] **Rodar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep PixKeyCard
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add components/devedores/PixKeyCard.tsx
git commit -m "feat(devedores): add PixKeyCard component"
```

---

## Task 7: CobrancaDialog component

**Files:**
- Create: `components/devedores/CobrancaDialog.tsx`

- [ ] **Criar `CobrancaDialog`**

Criar `components/devedores/CobrancaDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatCurrency } from '@/lib/utils/currency'
import { buildDebtMessage } from '@/lib/utils/debtMessage'
import { formatPhoneForWhatsApp } from '@/lib/utils/phone'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

interface CobrancaDialogProps {
  person: { id: string; name: string; phone: string | null }
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditPhone?: () => void
}

function CobrancaContent({
  person,
  openCharges,
  pixKey,
  onClose,
  onEditPhone,
}: {
  person: { id: string; name: string; phone: string | null }
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
  onClose: () => void
  onEditPhone?: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(openCharges.map((c) => c.id))
  )

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selected = openCharges.filter((c) => selectedIds.has(c.id))
  const total = selected.reduce((sum, c) => sum + c.amount, 0)
  const message = buildDebtMessage(person.name, selected, pixKey)
  const hasSelection = selected.length > 0

  function handleWhatsApp() {
    const url = `https://wa.me/${formatPhoneForWhatsApp(person.phone!)}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    onClose()
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    toast.success('Mensagem copiada!')
  }

  return (
    <div className="space-y-4">
      {!person.phone && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-small text-text-secondary">
          <span className="font-medium text-text-primary">{person.name}</span> não tem telefone
          cadastrado. Copie a mensagem abaixo e envie manualmente.
          {onEditPhone && (
            <>
              {' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => {
                  onClose()
                  onEditPhone()
                }}
              >
                Cadastrar telefone →
              </button>
            </>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-caption font-medium text-text-tertiary">Cobranças em aberto</p>
        <div className="space-y-0.5">
          {openCharges.map((charge) => (
            <Label
              key={charge.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-subtle"
            >
              <input
                type="checkbox"
                className="accent-accent h-4 w-4 shrink-0"
                checked={selectedIds.has(charge.id)}
                onChange={() => toggle(charge.id)}
              />
              <span className="min-w-0 flex-1 truncate text-body">{charge.description}</span>
              <span className="shrink-0 text-small text-text-tertiary">
                {new Date(charge.entryDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span className="shrink-0 text-body tabular-nums">
                {formatCurrency(charge.amount)}
              </span>
            </Label>
          ))}
          {openCharges.length === 0 && (
            <p className="py-2 text-small text-text-tertiary">Nenhuma cobrança em aberto.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-caption font-medium text-text-tertiary">Preview da mensagem</p>
        <div className="rounded-lg bg-bg-subtle p-3 text-small leading-relaxed whitespace-pre-wrap text-text-secondary">
          {hasSelection ? (
            message
          ) : (
            <span className="italic text-text-tertiary">Selecione ao menos uma cobrança.</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-small text-text-tertiary tabular-nums">
          {selected.length} selecionada{selected.length !== 1 ? 's' : ''} ·{' '}
          {formatCurrency(total)}
        </span>
        {person.phone ? (
          <Button
            variant="positive"
            disabled={!hasSelection}
            onClick={handleWhatsApp}
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={!hasSelection}
            onClick={handleCopy}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copiar mensagem
          </Button>
        )}
      </div>
    </div>
  )
}

export function CobrancaDialog({
  person,
  openCharges,
  pixKey,
  open,
  onOpenChange,
  onEditPhone,
}: CobrancaDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const title = 'Cobrar via WhatsApp'
  const subtitle = `${person.name} · ${person.phone ?? 'sem telefone'}`

  const content = (
    <CobrancaContent
      person={person}
      openCharges={openCharges}
      pixKey={pixKey}
      onClose={() => onOpenChange(false)}
      onEditPhone={onEditPhone}
    />
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <p className="text-small text-text-tertiary">{subtitle}</p>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <p className="text-small text-text-tertiary">{subtitle}</p>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">{content}</div>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Rodar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CobrancaDialog
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add components/devedores/CobrancaDialog.tsx
git commit -m "feat(devedores): add CobrancaDialog component"
```

---

## Task 8: Integração na página de lista

**Files:**
- Modify: `app/(app)/devedores/page.tsx`
- Modify: `components/devedores/DebtorList.tsx`

- [ ] **Atualizar `app/(app)/devedores/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPeopleWithBalances, getOpenChargesForPeople } from '@/lib/queries/debtors'
import { getUserPixKey } from '@/lib/queries/settings'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { DebtorList } from '@/components/devedores/DebtorList'
import { DebtorSummaryCards } from '@/components/devedores/DebtorSummaryCards'
import { PixKeyCard } from '@/components/devedores/PixKeyCard'

export default async function DevedoresPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [people, pixKey] = await Promise.all([
    getPeopleWithBalances(session.user.id),
    getUserPixKey(session.user.id),
  ])

  const personIds = people.map((p) => p.id)
  const openChargesByPerson = await getOpenChargesForPeople(session.user.id, personIds)

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Devedores"
          description="Acompanhe valores que outras pessoas devem a você."
        />
        <PersonDialog mode="create" />
      </div>

      <PixKeyCard pixKey={pixKey} />

      <DebtorSummaryCards people={people} />

      <Section title="Pessoas">
        <DebtorList
          people={people}
          openChargesByPerson={openChargesByPerson}
          pixKey={pixKey}
        />
      </Section>
    </PageLayout>
  )
}
```

- [ ] **Atualizar `components/devedores/DebtorList.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, MessageCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { PersonWithBalance, OpenChargeForLinking } from '@/lib/queries/debtors'
import { deletePersonIfEmpty } from '@/lib/actions/debtors'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { RowActions } from '@/components/ui/row-actions'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { CobrancaDialog } from '@/components/devedores/CobrancaDialog'

type Props = {
  people: PersonWithBalance[]
  openChargesByPerson: Record<string, OpenChargeForLinking[]>
  pixKey: string | null
}

export function DebtorList({ people, openChargesByPerson, pixKey }: Props) {
  const [editTarget, setEditTarget] = useState<PersonWithBalance | null>(null)
  const [cobrancaTarget, setCobrancaTarget] = useState<PersonWithBalance | null>(null)
  const router = useRouter()

  if (people.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Nenhuma pessoa cadastrada."
        description="Cadastre uma pessoa para começar a registrar cobranças."
      />
    )
  }

  const handleDelete = async (person: PersonWithBalance) => {
    try {
      await deletePersonIfEmpty(person.id)
      toast.success(`${person.name} excluída.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir.'
      toast.error(msg)
    }
  }

  return (
    <>
      <div className="divide-y divide-border overflow-hidden rounded-xl border bg-bg-surface">
        {people.map((person) => (
          <div key={person.id} className="group flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link
                href={`/devedores/${person.id}`}
                className="truncate text-small font-medium text-text-primary hover:text-accent-text"
              >
                {person.name}
              </Link>
              {(person.email || person.lastMovement) && (
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  {person.email && (
                    <span className="truncate text-caption text-text-tertiary">{person.email}</span>
                  )}
                  {person.email && person.lastMovement && (
                    <span className="shrink-0 text-caption text-text-tertiary">·</span>
                  )}
                  {person.lastMovement && (
                    <span className="shrink-0 text-caption text-text-tertiary">
                      {formatDate(person.lastMovement)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span
              className={cn(
                'shrink-0 text-small font-semibold tabular-nums',
                person.balance > 0
                  ? 'text-negative'
                  : person.balance < 0
                    ? 'text-positive'
                    : 'text-text-tertiary'
              )}
            >
              {person.balance === 0 ? (
                <Badge variant="muted">Quitado</Badge>
              ) : (
                formatCurrency(Math.abs(person.balance))
              )}
            </span>
            <RowActions
              onEdit={() => setEditTarget(person)}
              onDelete={person.balance === 0 ? () => handleDelete(person) : undefined}
              additionalActions={[
                {
                  label: 'Cobrar via WhatsApp',
                  icon: MessageCircle,
                  onClick: () => setCobrancaTarget(person),
                },
                {
                  label: 'Visualizar',
                  icon: Eye,
                  onClick: () => router.push(`/devedores/${person.id}`),
                },
              ]}
            />
          </div>
        ))}
      </div>

      {editTarget && (
        <PersonDialog
          mode="edit"
          person={editTarget}
          balance={editTarget.balance}
          open
          onOpenChange={(v) => {
            if (!v) setEditTarget(null)
          }}
        />
      )}

      {cobrancaTarget && (
        <CobrancaDialog
          person={cobrancaTarget}
          openCharges={openChargesByPerson[cobrancaTarget.id] ?? []}
          pixKey={pixKey}
          open
          onOpenChange={(v) => {
            if (!v) setCobrancaTarget(null)
          }}
          onEditPhone={() => {
            const target = cobrancaTarget
            setCobrancaTarget(null)
            setEditTarget(target)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Rodar typecheck**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add app/(app)/devedores/page.tsx components/devedores/DebtorList.tsx
git commit -m "feat(devedores): integrate CobrancaDialog and PixKeyCard in list page"
```

---

## Task 9: Integração na página de detalhe

**Files:**
- Create: `components/devedores/DevedorDetailActions.tsx`
- Modify: `app/(app)/devedores/[id]/page.tsx`

- [ ] **Criar `DevedorDetailActions`**

Criar `components/devedores/DevedorDetailActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { RowActions } from '@/components/ui/row-actions'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { CobrancaDialog } from '@/components/devedores/CobrancaDialog'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

interface DevedorDetailActionsProps {
  person: {
    id: string
    name: string
    email: string | null
    phone: string | null
    notes: string | null
  }
  balance: number
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
}

export function DevedorDetailActions({
  person,
  balance,
  openCharges,
  pixKey,
}: DevedorDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [cobrancaOpen, setCobrancaOpen] = useState(false)

  return (
    <>
      <RowActions
        onEdit={() => setEditOpen(true)}
        additionalActions={[
          {
            label: 'Cobrar via WhatsApp',
            icon: MessageCircle,
            onClick: () => setCobrancaOpen(true),
          },
        ]}
      />

      <PersonDialog
        mode="edit"
        person={person}
        balance={balance}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <CobrancaDialog
        person={person}
        openCharges={openCharges}
        pixKey={pixKey}
        open={cobrancaOpen}
        onOpenChange={setCobrancaOpen}
        onEditPhone={() => {
          setCobrancaOpen(false)
          setEditOpen(true)
        }}
      />
    </>
  )
}
```

- [ ] **Atualizar `app/(app)/devedores/[id]/page.tsx`**

```tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getPersonDebtDetails,
  getTransactionsForDebtLink,
  getOpenChargesForPerson,
} from '@/lib/queries/debtors'
import { getUserPixKey } from '@/lib/queries/settings'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { DebtChargeDialog } from '@/components/devedores/DebtChargeDialog'
import { DebtPaymentDialog } from '@/components/devedores/DebtPaymentDialog'
import { DebtEntryList } from '@/components/devedores/DebtEntryList'
import { DebtorDetailSummary } from '@/components/devedores/DebtorDetailSummary'
import { DebtBalanceEvolutionChart } from '@/components/devedores/DebtBalanceEvolutionChart'
import { DevedorDetailActions } from '@/components/devedores/DevedorDetailActions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function DevedorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params])
  if (!session) redirect('/login')

  const [data, txForLink, openCharges, pixKey] = await Promise.all([
    getPersonDebtDetails(session.user.id, id),
    getTransactionsForDebtLink(session.user.id),
    getOpenChargesForPerson(session.user.id, id),
    getUserPixKey(session.user.id),
  ])
  if (!data) notFound()

  const { person, summary, balanceEvolution, entries } = data

  return (
    <PageLayout>
      <Link
        href="/devedores"
        className="flex w-fit items-center gap-1.5 text-small text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Devedores
      </Link>

      <div className="flex items-start justify-between gap-4">
        <PageHeader title={person.name} description={person.email ?? person.phone ?? undefined} />
        <DevedorDetailActions
          person={person}
          balance={summary.balance}
          openCharges={openCharges}
          pixKey={pixKey}
        />
      </div>

      <DebtorDetailSummary summary={summary} hasEntries={entries.length > 0} />

      <div className="flex gap-2">
        <DebtChargeDialog personId={person.id} transactions={txForLink} />
        <DebtPaymentDialog personId={person.id} openCharges={openCharges} />
      </div>

      <Section title="Evolução do saldo">
        <DebtBalanceEvolutionChart data={balanceEvolution} />
      </Section>

      <Section title="Histórico de lançamentos">
        <DebtEntryList entries={entries} personId={person.id} />
      </Section>
    </PageLayout>
  )
}
```

- [ ] **Rodar typecheck**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add components/devedores/DevedorDetailActions.tsx app/(app)/devedores/[id]/page.tsx
git commit -m "feat(devedores): integrate CobrancaDialog in detail page"
```

---

## Task 10: Verificação final

- [ ] **Suite completa**

```bash
npm run lint && npx prettier --check . && npx tsc --noEmit && npm test
```

Esperado: todos passando, sem warnings ESLint.

- [ ] **Corrigir eventuais erros de lint/formato**

Se o pre-commit hook rejeitar, rodar:
```bash
npx prettier --write .
npm run lint -- --fix
```

E commitar as correções.
