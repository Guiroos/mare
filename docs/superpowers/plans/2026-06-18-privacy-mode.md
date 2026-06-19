# Privacy Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um modo privado que oculta valores monetários sensíveis nas páginas financeiras principais, ativável via SettingsDialog e pelo header de cada página coberta.

**Architecture:** `PrivacyModeContext` (client provider em `components/providers/`) expõe `isPrivate`, `toggle`, e `mask(n)`. Componentes leaf de Server → `'use client'`. Tabelas inline em Server Component pages são extraídas para client components que recebem os dados como props. Provider entra no `app/(app)/layout.tsx` envolvendo o `RegistrationDialogProvider` existente.

**Tech Stack:** Next.js 14 App Router, React context, `localStorage`, Lucide icons, DS Maré.

## Global Constraints

- Vitest environment é `node` — sem jsdom; testar apenas funções puras
- Nenhum valor arbitrário Tailwind `[...]`; usar apenas tokens do DS Maré
- Seguir padrão de ownership de componentes: compostos usam primitivos do DS
- Commit após cada task com mensagem no formato `feat(privacy): ...`
- Nunca usar `formatCurrency` diretamente onde o valor precisa ser mascarável; usar `SensitiveAmount` ou `mask()`

---

## File Map

**Criar:**
- `components/providers/PrivacyMode.tsx` — Context, Provider, `usePrivacyMode`, `maskValue`, `SensitiveAmount`, `SensitiveMoneyBadge`, `PrivacyToggle`
- `__tests__/unit/privacy-mode.test.ts` — testes unitários de `maskValue`
- `components/panorama/PanoramaTable.tsx` — extração da tabela mensal do panorama/page.tsx
- `components/investimentos/WithdrawalTable.tsx` — extração da tabela de resgates de investimentos/page.tsx
- `components/metas/MetasList.tsx` — extração da lista de metas de metas/page.tsx

**Modificar:**
- `app/(app)/layout.tsx` — adicionar `<PrivacyModeProvider>`
- `components/settings/SettingsDialog.tsx` — adicionar Switch de modo privado
- `components/dashboard/SummaryCards.tsx` — converter para `'use client'`, usar `SensitiveAmount`
- `components/dashboard/IncomeList.tsx` — usar `SensitiveAmount`
- `components/dashboard/InvestmentList.tsx` — usar `SensitiveAmount`
- `components/dashboard/FixedExpenseList.tsx` — usar `SensitiveAmount`
- `components/dashboard/TransactionList.tsx` — usar `SensitiveAmount` + `usePrivacyMode` para totais de string
- `app/(app)/dashboard/page.tsx` — adicionar `<PrivacyToggle>` + `<SensitiveMoneyBadge>`
- `app/(app)/historico/HistoricoClient.tsx` — usar `SensitiveAmount` + `usePrivacyMode`
- `app/(app)/historico/page.tsx` — adicionar `<PrivacyToggle>`
- `components/investimentos/PatrimonyHero.tsx` — converter para `'use client'`, usar `SensitiveAmount`
- `components/investimentos/InvestmentTypeCard.tsx` — usar `SensitiveAmount`
- `components/investimentos/InvestmentTypeAccordion.tsx` — usar `SensitiveAmount`
- `app/(app)/investimentos/page.tsx` — usar `<WithdrawalTable>`, adicionar `<PrivacyToggle>`
- `app/(app)/metas/page.tsx` — usar `<MetasList>`, adicionar `<PrivacyToggle>`
- `components/panorama/AnnualSummaryCards.tsx` — converter para `'use client'`, usar `SensitiveAmount`
- `app/(app)/panorama/page.tsx` — usar `<PanoramaTable>`, adicionar `<PrivacyToggle>`

---

## Task 1: Core — PrivacyMode.tsx + unit tests

**Files:**
- Create: `components/providers/PrivacyMode.tsx`
- Create: `__tests__/unit/privacy-mode.test.ts`

**Interfaces:**
- Produces:
  - `maskValue(value: number, isPrivate: boolean): string`
  - `usePrivacyMode(): { isPrivate: boolean; toggle: () => void; mask: (value: number) => string }`
  - `PrivacyModeProvider({ children: ReactNode }): JSX.Element`
  - `SensitiveAmount({ value: number; className?: string }): JSX.Element`
  - `SensitiveMoneyBadge({ value: number; variant: 'positive' | 'muted'; size?: 'sm' }): JSX.Element | null`
  - `PrivacyToggle(): JSX.Element`

- [x] **Step 1: Escrever o teste que vai falhar**

Criar `__tests__/unit/privacy-mode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { maskValue } from '@/components/providers/PrivacyMode'

describe('maskValue', () => {
  it('returns formatted currency when not private', () => {
    const result = maskValue(1234.5, false)
    expect(result).toContain('R$')
    expect(result).toContain('1.234')
  })

  it('returns placeholder when private, regardless of value', () => {
    expect(maskValue(1234.5, true)).toBe('R$ ••••')
    expect(maskValue(0, true)).toBe('R$ ••••')
    expect(maskValue(-100, true)).toBe('R$ ••••')
  })
})
```

- [x] **Step 2: Rodar o teste para confirmar que falha**

```bash
npm test -- privacy-mode
```

Esperado: `FAIL` com "Cannot find module '@/components/providers/PrivacyMode'"

- [x] **Step 3: Criar `components/providers/PrivacyMode.tsx`**

```tsx
'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'

type PrivacyModeCtx = {
  isPrivate: boolean
  toggle: () => void
}

const ctx = createContext<PrivacyModeCtx>({ isPrivate: false, toggle: () => {} })

/** Pure helper — testable without React. */
export function maskValue(value: number, isPrivate: boolean): string {
  return isPrivate ? 'R$ ••••' : formatCurrency(value)
}

export function usePrivacyMode() {
  const { isPrivate, toggle } = useContext(ctx)
  return { isPrivate, toggle, mask: (value: number) => maskValue(value, isPrivate) }
}

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    setIsPrivate(localStorage.getItem('mare:privacy-mode') === 'true')
  }, [])

  function toggle() {
    setIsPrivate((prev) => {
      const next = !prev
      localStorage.setItem('mare:privacy-mode', String(next))
      return next
    })
  }

  return <ctx.Provider value={{ isPrivate, toggle }}>{children}</ctx.Provider>
}

export function SensitiveAmount({ value, className }: { value: number; className?: string }) {
  const { isPrivate } = useContext(ctx)
  return <span className={className}>{maskValue(value, isPrivate)}</span>
}

export function SensitiveMoneyBadge({
  value,
  variant,
  size = 'sm',
}: {
  value: number
  variant: 'positive' | 'muted'
  size?: 'sm'
}) {
  const { mask } = usePrivacyMode()
  if (value <= 0) return null
  return (
    <Badge variant={variant} size={size}>
      {mask(value)}
    </Badge>
  )
}

export function PrivacyToggle() {
  const { isPrivate, toggle } = useContext(ctx)
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isPrivate ? 'Mostrar valores' : 'Ocultar valores'}
    >
      {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  )
}
```

- [x] **Step 4: Rodar o teste para confirmar que passa**

```bash
npm test -- privacy-mode
```

Esperado: `PASS` — 2 testes verdes.

- [x] **Step 5: Commit**

```bash
git add components/providers/PrivacyMode.tsx __tests__/unit/privacy-mode.test.ts
git commit -m "feat(privacy): add PrivacyModeProvider, SensitiveAmount, PrivacyToggle"
```

---

## Task 2: Provider wiring + SettingsDialog toggle

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/settings/SettingsDialog.tsx`

**Interfaces:**
- Consumes: `PrivacyModeProvider` de `@/components/providers/PrivacyMode`
- Consumes: `usePrivacyMode` de `@/components/providers/PrivacyMode`
- Consumes: `Switch` de `@/components/ui/switch`

- [x] **Step 1: Adicionar `PrivacyModeProvider` ao layout**

Em `app/(app)/layout.tsx`, importar e envolver `RegistrationDialogProvider`:

```tsx
import { PrivacyModeProvider } from '@/components/providers/PrivacyMode'

// ...dentro do return:
return (
  <PrivacyModeProvider>
    <RegistrationDialogProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar user={{ name: session.user?.name, email: session.user?.email }} isAdmin={isAdmin} />
        <main className="pb-20 lg:pb-0 lg:pl-60">
          <div className="px-4 py-6 lg:px-8 lg:py-7">{children}</div>
        </main>
        <BottomNav />
      </div>
    </RegistrationDialogProvider>
  </PrivacyModeProvider>
)
```

- [x] **Step 2: Adicionar seção "Privacidade" no SettingsDialog**

Em `components/settings/SettingsDialog.tsx`, importar `usePrivacyMode` e `Switch`:

```tsx
import { usePrivacyMode } from '@/components/providers/PrivacyMode'
import { Switch } from '@/components/ui/switch'
```

Dentro de `SettingsContent`, adicionar após o bloco "Aparência" e antes do bloco "Zona de perigo":

```tsx
const { isPrivate, toggle } = usePrivacyMode()

// ...depois do bloco de Aparência:
<div>
  <p className="mb-1 text-small font-semibold text-text-primary">Privacidade</p>
  <p className="mb-3 text-small text-text-secondary">
    Oculta valores monetários nas páginas financeiras.
  </p>
  <Switch
    label="Modo privado"
    checked={isPrivate}
    onChange={toggle}
  />
</div>
```

- [x] **Step 3: Teste manual**

```bash
npm run dev
```

1. Abrir `/dashboard` → clicar em Configurações → verificar nova seção "Privacidade" com Switch
2. Ativar o Switch → verificar que `localStorage.getItem('mare:privacy-mode')` retorna `'true'` no console
3. Recarregar a página → Switch deve continuar ativo

- [x] **Step 4: Commit**

```bash
git add app/\(app\)/layout.tsx components/settings/SettingsDialog.tsx
git commit -m "feat(privacy): wire provider to layout and add settings toggle"
```

---

## Task 3: Dashboard

**Files:**
- Modify: `components/dashboard/SummaryCards.tsx`
- Modify: `components/dashboard/IncomeList.tsx`
- Modify: `components/dashboard/InvestmentList.tsx`
- Modify: `components/dashboard/FixedExpenseList.tsx`
- Modify: `components/dashboard/TransactionList.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `SensitiveAmount`, `SensitiveMoneyBadge`, `PrivacyToggle`, `usePrivacyMode` de `@/components/providers/PrivacyMode`

- [x] **Step 1: Converter SummaryCards para client + usar SensitiveAmount**

Em `components/dashboard/SummaryCards.tsx`, adicionar `'use client'` na primeira linha e importar `SensitiveAmount`:

```tsx
'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
```

Remover `import { formatCurrency }`. Substituir cada `formatCurrency(x)` pelo `<SensitiveAmount value={x} />` com a mesma `className` do elemento pai. As trocas específicas:

```tsx
// Linha com balance hero — de:
<p className="mb-5 mt-1.5 text-hero tabular-nums">{formatCurrency(balance)}</p>
// Para:
<p className="mb-5 mt-1.5 text-hero tabular-nums">
  <SensitiveAmount value={balance} />
</p>

// Entradas — de:
<span className="text-body-lg font-semibold tabular-nums tracking-tight">
  + {formatCurrency(totalIncomes)}
</span>
// Para:
<span className="text-body-lg font-semibold tabular-nums tracking-tight">
  + <SensitiveAmount value={totalIncomes} />
</span>

// Gastos — de:
<span className="text-body-lg font-semibold tabular-nums tracking-tight">
  − {formatCurrency(totalExpenses)}
</span>
// Para:
<span className="text-body-lg font-semibold tabular-nums tracking-tight">
  − <SensitiveAmount value={totalExpenses} />
</span>

// Investido — de:
<span className="text-body font-semibold tabular-nums tracking-tight opacity-85">
  {formatCurrency(totalInvested)}
</span>
// Para:
<span className="text-body font-semibold tabular-nums tracking-tight opacity-85">
  <SensitiveAmount value={totalInvested} />
</span>

// Budget bar — linha com valores absolutos — de:
<span className="block text-caption tabular-nums opacity-70 lg:inline">
  {' '}
  · {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
</span>
// Para:
<span className="block text-caption tabular-nums opacity-70 lg:inline">
  {' '}
  · <SensitiveAmount value={totalSpent} /> / <SensitiveAmount value={totalBudget} />
</span>
```

- [x] **Step 2: Usar SensitiveAmount em IncomeList**

Em `components/dashboard/IncomeList.tsx`, importar `SensitiveAmount`:

```tsx
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
```

Remover import de `formatCurrency`. Substituir:

```tsx
// De:
<span className="flex-shrink-0 text-body font-semibold tabular-nums text-positive-text">
  + {formatCurrency(Number(income.amount))}
</span>
// Para:
<span className="flex-shrink-0 text-body font-semibold tabular-nums text-positive-text">
  + <SensitiveAmount value={Number(income.amount)} />
</span>
```

- [x] **Step 3: Usar SensitiveAmount em InvestmentList**

Em `components/dashboard/InvestmentList.tsx`, importar `SensitiveAmount` e remover `formatCurrency`:

```tsx
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
```

Substituir (2 ocorrências):

```tsx
// Aporte — de:
<span className="text-small font-semibold tabular-nums text-text-primary">
  + {formatCurrency(Number(inv.amount))}
</span>
// Para:
<span className="text-small font-semibold tabular-nums text-text-primary">
  + <SensitiveAmount value={Number(inv.amount)} />
</span>

// Rendimento — de:
<span className="text-caption font-semibold tabular-nums text-positive-text">
  Rend. {formatCurrency(Number(inv.yieldAmount))}
</span>
// Para:
<span className="text-caption font-semibold tabular-nums text-positive-text">
  Rend. <SensitiveAmount value={Number(inv.yieldAmount)} />
</span>
```

- [x] **Step 4: Usar SensitiveAmount em FixedExpenseList**

Em `components/dashboard/FixedExpenseList.tsx`, importar `SensitiveAmount` e remover `formatCurrency`. Substituir em linha 156:

```tsx
// De:
{formatCurrency(Number(e.amount))}
// Para:
<SensitiveAmount value={Number(e.amount)} />
```

- [x] **Step 5: Usar SensitiveAmount em TransactionList**

Em `components/dashboard/TransactionList.tsx`, importar `SensitiveAmount` e `usePrivacyMode`. O `formatCurrency` ainda é usado para totais de string; manter o import mas adicionar o novo:

```tsx
import { SensitiveAmount, usePrivacyMode } from '@/components/providers/PrivacyMode'
```

**5a — TransactionRow (linha 181):**
```tsx
// De:
<span className="text-body font-semibold tabular-nums text-negative">
  − {formatCurrency(Number(t.amount))}
</span>
// Para:
<span className="text-body font-semibold tabular-nums text-negative">
  − <SensitiveAmount value={Number(t.amount)} />
</span>
```

**5b — DateGroupedView TxGroupHeader total (linha 242):** adicionar `usePrivacyMode` na função `DateGroupedView` e usar `mask`:

```tsx
function DateGroupedView({ ... }) {
  const { mask } = usePrivacyMode()
  // ...
  // De:
  total={`− ${formatCurrency(items.reduce((s, t) => s + Number(t.amount), 0))}`}
  // Para:
  total={`− ${mask(items.reduce((s, t) => s + Number(t.amount), 0))}`}
```

**5c — AccountGroupedView header (linha 306):** adicionar `usePrivacyMode` na função e usar `<SensitiveAmount>`:
```tsx
function AccountGroupedView({ ... }) {
  const { isPrivate } = usePrivacyMode()
  // ...
  // De:
  <span className="shrink-0 text-body font-semibold tabular-nums text-negative">
    − {formatCurrency(g.total)}
  </span>
  // Para:
  <span className="shrink-0 text-body font-semibold tabular-nums text-negative">
    − <SensitiveAmount value={g.total} />
  </span>
```

**5d — TypeGroupedView header (linha 353):** mesmo padrão:
```tsx
// De:
<span className="shrink-0 text-body font-semibold tabular-nums text-negative">
  − {formatCurrency(total)}
</span>
// Para:
<span className="shrink-0 text-body font-semibold tabular-nums text-negative">
  − <SensitiveAmount value={total} />
</span>
```

- [x] **Step 6: Atualizar dashboard/page.tsx — PrivacyToggle + SensitiveMoneyBadge**

Em `app/(app)/dashboard/page.tsx`, importar:

```tsx
import { PrivacyToggle, SensitiveMoneyBadge } from '@/components/providers/PrivacyMode'
```

**6a — MonthSelector action (juntar PrivacyToggle ao DashboardFAB):**
```tsx
// De:
action={<DashboardFAB month={month} />}
// Para:
action={
  <div className="flex items-center gap-1">
    <PrivacyToggle />
    <DashboardFAB month={month} />
  </div>
}
```

**6b — Badge de Entradas:**
```tsx
// De:
action={
  totalIncomes > 0 ? (
    <Badge variant="positive" size="sm">
      {formatCurrency(totalIncomes)}
    </Badge>
  ) : undefined
}
// Para:
action={<SensitiveMoneyBadge value={totalIncomes} variant="positive" />}
```

**6c — Badge de Investimentos:**
```tsx
// De:
action={
  totalInvested > 0 ? (
    <Badge variant="muted" size="sm">
      {formatCurrency(totalInvested)}
    </Badge>
  ) : undefined
}
// Para:
action={<SensitiveMoneyBadge value={totalInvested} variant="muted" />}
```

Remover o import de `Badge` e `formatCurrency` de `dashboard/page.tsx` se não forem mais usados em outros lugares (verificar).

- [x] **Step 7: Teste manual**

```bash
npm run dev
```

1. Navegar para `/dashboard`
2. Clicar no ícone de olho no header → valores devem mudar para `R$ ••••`
3. `SummaryCards` (hero), IncomeList, InvestmentList, FixedExpenseList, TransactionList — todos mascarados
4. Desativar → valores voltam
5. Recarregar → estado persiste

- [x] **Step 8: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

Esperado: sem erros.

- [x] **Step 9: Commit**

```bash
git add components/dashboard/SummaryCards.tsx components/dashboard/IncomeList.tsx \
  components/dashboard/InvestmentList.tsx components/dashboard/FixedExpenseList.tsx \
  components/dashboard/TransactionList.tsx app/\(app\)/dashboard/page.tsx
git commit -m "feat(privacy): mask sensitive values in dashboard"
```

---

## Task 4: Histórico

**Files:**
- Modify: `app/(app)/historico/HistoricoClient.tsx`
- Modify: `app/(app)/historico/page.tsx`

**Interfaces:**
- Consumes: `SensitiveAmount`, `PrivacyToggle`, `usePrivacyMode` de `@/components/providers/PrivacyMode`

- [x] **Step 1: Mascarar valores em HistoricoClient**

Em `app/(app)/historico/HistoricoClient.tsx`, importar:

```tsx
import { SensitiveAmount, usePrivacyMode } from '@/components/providers/PrivacyMode'
```

**1a — SummaryCards interno (linhas 71, 77, 83) — componente local `SummaryCards` dentro de HistoricoClient:**
Adicionar `const { isPrivate } = usePrivacyMode()` no topo de `SummaryCards` e substituir as 3 chamadas de `formatCurrency`:

```tsx
function SummaryCards({ items }: { items: HistoricoFeedItem[] }) {
  // ... cálculos existentes ...
  const { isPrivate } = usePrivacyMode()

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg bg-positive-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-positive-text">
          <SensitiveAmount value={entradas} />
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">entradas</p>
      </div>
      <div className="rounded-lg bg-negative-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-negative-text">
          <SensitiveAmount value={saidas} />
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">saídas</p>
      </div>
      <div className="rounded-lg bg-accent-subtle p-3 text-center">
        <p className="text-body font-semibold tabular-nums text-accent-text">
          <SensitiveAmount value={investido} />
        </p>
        <p className="mt-0.5 text-caption text-text-tertiary">investido</p>
      </div>
      {/* card de contagem permanece igual */}
    </div>
  )
}
```

**1b — FeedRow (linha 160):**
```tsx
// De:
{debit ? '−' : '+'} {formatCurrency(toAmount(item.amount))}
// Para:
{debit ? '−' : '+'} <SensitiveAmount value={toAmount(item.amount)} />
```

**1c — TxGroupHeader total (linha 214):** adicionar `usePrivacyMode` na função/componente que renderiza os grupos e usar `mask`:
```tsx
// De:
total={`${formatCurrency(groupItems.filter((i) => isDebit(i.kind)).reduce((s, i) => s + toAmount(i.amount), 0))} saídas`}
// Para (usar mask() pois total é string):
const { mask } = usePrivacyMode() // no componente pai que mapeia os grupos
total={`${mask(groupItems.filter((i) => isDebit(i.kind)).reduce((s, i) => s + toAmount(i.amount), 0))} saídas`}
```

- [x] **Step 2: Adicionar PrivacyToggle no header do Histórico**

Em `app/(app)/historico/page.tsx`, importar `PrivacyToggle` e envolver o `PageHeader` com flex layout:

```tsx
import { PrivacyToggle } from '@/components/providers/PrivacyMode'

// De:
<PageHeader title="Histórico" description="Todas as movimentações" />
// Para:
<div className="flex items-start justify-between gap-4">
  <PageHeader title="Histórico" description="Todas as movimentações" />
  <PrivacyToggle />
</div>
```

- [x] **Step 3: Teste manual**

```bash
npm run dev
```

1. Navegar para `/historico`
2. Clicar no ícone de olho → valores de cada item e SummaryCards mascarados
3. Verificar que o estado é compartilhado com dashboard (mesmo `localStorage`)

- [x] **Step 4: Commit**

```bash
git add app/\(app\)/historico/HistoricoClient.tsx app/\(app\)/historico/page.tsx
git commit -m "feat(privacy): mask sensitive values in historico"
```

---

## Task 5: Investimentos

**Files:**
- Modify: `components/investimentos/PatrimonyHero.tsx`
- Modify: `components/investimentos/InvestmentTypeCard.tsx`
- Modify: `components/investimentos/InvestmentTypeAccordion.tsx`
- Create: `components/investimentos/WithdrawalTable.tsx`
- Modify: `app/(app)/investimentos/page.tsx`

**Interfaces:**
- Consumes: `SensitiveAmount`, `PrivacyToggle`, `usePrivacyMode` de `@/components/providers/PrivacyMode`
- Produces: `WithdrawalTable({ withdrawals, investmentTypeOptions })`

- [x] **Step 1: Converter PatrimonyHero para client + SensitiveAmount**

Em `components/investimentos/PatrimonyHero.tsx`, adicionar `'use client'` na primeira linha e importar `SensitiveAmount`:

```tsx
'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
```

Remover import de `formatCurrency`. Substituir as 6 chamadas de `formatCurrency`:

```tsx
// Total — de:
<span className="text-hero tabular-nums xl:text-h1 2xl:text-hero">
  {formatCurrency(total)}
</span>
// Para:
<span className="text-hero tabular-nums xl:text-h1 2xl:text-hero">
  <SensitiveAmount value={total} />
</span>

// Delta badge — de:
{delta >= 0 ? '+ ' : '− '}
{formatCurrency(Math.abs(delta))}
// Para:
{delta >= 0 ? '+ ' : '− '}
<SensitiveAmount value={Math.abs(delta)} />

// Aporte acumulado — de:
<span className="whitespace-nowrap text-h2 tabular-nums">
  {formatCurrency(totalAporte)}
</span>
// Para:
<span className="whitespace-nowrap text-h2 tabular-nums">
  <SensitiveAmount value={totalAporte} />
</span>

// Rendimento acumulado — de:
<span className="whitespace-nowrap text-h2 tabular-nums">
  {formatCurrency(totalYield)}
</span>
// Para:
<span className="whitespace-nowrap text-h2 tabular-nums">
  <SensitiveAmount value={totalYield} />
</span>

// Este mês (net positivo) — de:
{thisMonthNet > 0 ? `+ ${formatCurrency(thisMonthNet)}` : formatCurrency(0)}
// Para:
{thisMonthNet > 0 ? <>+ <SensitiveAmount value={thisMonthNet} /></> : <SensitiveAmount value={0} />}

// Este mês caption — de:
aporte {formatCurrency(thisMonthAporte)} · rend. {formatCurrency(thisMonthYield)}
// Para:
aporte <SensitiveAmount value={thisMonthAporte} /> · rend. <SensitiveAmount value={thisMonthYield} />
```

- [x] **Step 2: Usar SensitiveAmount em InvestmentTypeCard**

Em `components/investimentos/InvestmentTypeCard.tsx`, importar `SensitiveAmount` e remover import de `formatCurrency`:

```tsx
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
```

Substituir as 7 ocorrências (linhas 201, 207, 224, 288, 296, 378, 386):

```tsx
// Linha 201 — totalAmount:
<strong className="font-semibold tabular-nums text-text-primary">
  <SensitiveAmount value={totalAmount} />
</strong>

// Linha 207 — totalYield:
<strong className="font-semibold tabular-nums text-text-primary">
  <SensitiveAmount value={totalYield} />
</strong>

// Linha 224 — currentBalance:
<span className="text-h2 tabular-nums"><SensitiveAmount value={balance.currentBalance} /></span>

// Linha 286-292 — entry.amount condicional (entry.amount é number | null):
{entry.amount !== null ? (
  <SensitiveAmount value={entry.amount} />
) : (
  <span className="text-text-tertiary">—</span>
)}

// Linha 294-296 — entry.yieldAmount:
{entry.yieldAmount !== null ? (
  <span className="font-semibold text-positive-text">
    + <SensitiveAmount value={entry.yieldAmount} />
  </span>
) : isPending ? ( ... ) : ( ... )}

// Linha 378 — avgAporte:
<strong className="font-semibold tabular-nums text-text-primary">
  <SensitiveAmount value={avgAporte} />
</strong>

// Linha 386 — avgYield:
<strong className="font-semibold tabular-nums text-text-primary">
  <SensitiveAmount value={avgYield} />
</strong>
```

- [x] **Step 3: Usar SensitiveAmount em InvestmentTypeAccordion**

Em `components/investimentos/InvestmentTypeAccordion.tsx`, importar `SensitiveAmount`:

```tsx
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
```

Substituir as 5 ocorrências (linhas 202, 227, 233, 270, 280):

```tsx
// Linha 202 — currentBalance:
<SensitiveAmount value={balance.currentBalance} />

// Linha 227 — totalAmount:
<SensitiveAmount value={balance.totalAmount} />

// Linha 233 — totalYield:
<SensitiveAmount value={balance.totalYield} />

// Linhas 268-273 — entry.amount condicional (mesmo padrão de InvestmentTypeCard):
{entry.amount !== null ? (
  <SensitiveAmount value={entry.amount} />
) : (
  <span className="text-text-tertiary">—</span>
)}

// Linhas 279-280 — entry.yieldAmount:
<span className="font-semibold tabular-nums text-positive-text">
  + <SensitiveAmount value={entry.yieldAmount} />
</span>
```

Remover import de `formatCurrency` se não houver mais usos.

- [x] **Step 4: Criar WithdrawalTable**

Criar `components/investimentos/WithdrawalTable.tsx` extraindo o bloco `<table>` da seção "Resgates" de `investimentos/page.tsx`. O componente precisa dos imports de `deleteWithdrawal`, `WithdrawalEditButton`, `DeleteButton`, `Badge`, `formatDate`:

```tsx
'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { WithdrawalEditButton } from '@/components/investimentos/WithdrawalEditButton'
import { deleteWithdrawal } from '@/lib/actions/investments'
import { formatDate } from '@/lib/utils/date'

type Withdrawal = {
  id: string
  typeName: string
  date: string
  amount: number
  taxAmount: number | null
  destination: string
  notes: string | null
}

type InvestmentTypeOption = { id: string; name: string }

export function WithdrawalTable({
  withdrawals,
  investmentTypeOptions,
}: {
  withdrawals: Withdrawal[]
  investmentTypeOptions: InvestmentTypeOption[]
}) {
  if (withdrawals.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-subtle">
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Tipo</th>
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Data</th>
            <th className="px-5 py-2 text-right text-label uppercase text-text-tertiary">Valor</th>
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Destino</th>
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Notas</th>
            <th className="px-5 py-2" />
          </tr>
        </thead>
        <tbody>
          {withdrawals.map((w) => (
            <tr key={w.id} className="border-t border-border hover:bg-bg-subtle">
              <td className="px-5 py-2.5 text-small">{w.typeName}</td>
              <td className="px-5 py-2.5 text-small text-text-secondary">{formatDate(w.date)}</td>
              <td className="px-5 py-2.5 text-right">
                <span className="text-small font-semibold tabular-nums text-negative">
                  − <SensitiveAmount value={w.amount} />
                </span>
                {w.taxAmount !== null && (
                  <span className="block text-caption tabular-nums text-text-tertiary">
                    Bruto <SensitiveAmount value={w.amount + w.taxAmount} /> · IR{' '}
                    <SensitiveAmount value={w.taxAmount} />
                  </span>
                )}
              </td>
              <td className="px-5 py-2.5">
                {w.destination === 'income' ? (
                  <Badge variant="muted">Caixa</Badge>
                ) : (
                  <Badge variant="muted">Transferência</Badge>
                )}
              </td>
              <td className="max-w-32 truncate px-5 py-2.5 text-caption text-text-secondary">
                {w.notes ?? ''}
              </td>
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-1">
                  <WithdrawalEditButton withdrawal={w} investmentTypes={investmentTypeOptions} />
                  <DeleteButton
                    onDelete={async () => {
                      'use server'
                      await deleteWithdrawal(w.id)
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Nota:** a action `deleteWithdrawal` marcada com `'use server'` inline funciona em Client Components — Next.js suporta isso.

- [x] **Step 5: Atualizar investimentos/page.tsx**

Em `app/(app)/investimentos/page.tsx`:

**5a — importar novos componentes:**
```tsx
import { PrivacyToggle } from '@/components/providers/PrivacyMode'
import { WithdrawalTable } from '@/components/investimentos/WithdrawalTable'
```

**5b — adicionar PrivacyToggle ao header (já tem `div flex items-start justify-between`):**
```tsx
// De:
<div className="hidden items-center gap-2 lg:flex">
  <InvestmentTypeDialog mode="create" triggerSize="md" />
  <InvestmentEntryDialog investmentTypes={investmentTypeOptions} />
</div>
// Para:
<div className="hidden items-center gap-2 lg:flex">
  <PrivacyToggle />
  <InvestmentTypeDialog mode="create" triggerSize="md" />
  <InvestmentEntryDialog investmentTypes={investmentTypeOptions} />
</div>
```

**5c — substituir a `<table>` de resgates pelo novo componente.** Localizar o bloco que começa com `{withdrawals.length === 0 ? (` e substituir o `else` branch (a `<div className="overflow-x-auto">` com a table completa) por:
```tsx
) : (
  <WithdrawalTable
    withdrawals={withdrawals}
    investmentTypeOptions={investmentTypeOptions}
  />
)}
```

Remover imports não mais usados: `formatCurrency`, `formatDate`, `WithdrawalEditButton`, `DeleteButton` de `investimentos/page.tsx` caso fiquem sem uso (verificar resto do arquivo).

- [ ] **Step 6: Teste manual**

1. Navegar para `/investimentos`
2. Ativar modo privado → PatrimonyHero, InvestmentTypeCard, InvestmentTypeAccordion e WithdrawalTable mascarados
3. Verificar que o PrivacyToggle no header funciona

- [x] **Step 7: Commit**

```bash
git add components/investimentos/PatrimonyHero.tsx \
  components/investimentos/InvestmentTypeCard.tsx \
  components/investimentos/InvestmentTypeAccordion.tsx \
  components/investimentos/WithdrawalTable.tsx \
  app/\(app\)/investimentos/page.tsx
git commit -m "feat(privacy): mask sensitive values in investimentos"
```

---

## Task 6: Metas

**Files:**
- Create: `components/metas/MetasList.tsx`
- Modify: `app/(app)/metas/page.tsx`

**Interfaces:**
- Consumes: `SensitiveAmount`, `PrivacyToggle` de `@/components/providers/PrivacyMode`
- Produces: `MetasList({ goals, investmentTypeOptions })`

- [ ] **Step 1: Criar MetasList.tsx**

Criar `components/metas/MetasList.tsx` extraindo a lista de metas (o bloco que começa em `goalsData.length === 0 ? ...`) de `metas/page.tsx`. O componente precisa dos tipos, actions e sub-componentes já importados na page:

```tsx
'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Separator } from '@/components/ui/separator'
import { GoalDialog } from '@/components/metas/GoalDialog'
import { ContributionDialog } from '@/components/metas/ContributionDialog'
import { ContributionEditButton } from '@/components/metas/ContributionEditButton'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteGoal, deleteGoalContribution } from '@/lib/actions/goals'
import { formatMonthName, referenceMonthToYearMonth } from '@/lib/utils/date'

type Contribution = {
  id: string
  referenceMonth: string
  amount: number
}

type Goal = {
  id: string
  name: string
  progress: number
  currentBalance: number
  targetAmount: number
  targetDate: string | null
  investmentTypeName: string | null
  investmentTypeId: string | null
  projectedCompletionYearMonth: string | null
  contributions: Contribution[]
}

type InvestmentTypeOption = { id: string; name: string }

export function MetasList({
  goals,
  investmentTypeOptions,
}: {
  goals: Goal[]
  investmentTypeOptions: InvestmentTypeOption[]
}) {
  if (goals.length === 0) {
    return (
      <EmptyState title="Nenhuma meta cadastrada. Crie sua primeira meta para começar." />
    )
  }

  return (
    <div className="space-y-3">
      {goals.map((goal) => {
        const isComplete = goal.progress >= 100
        return (
          <div key={goal.id} className="rounded-xl border bg-bg-surface">
            {/* Header */}
            <div className="px-4 pb-3 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{goal.name}</span>
                  {isComplete && <Badge variant="positive">Meta atingida!</Badge>}
                  {goal.investmentTypeName && (
                    <Badge variant="muted">{goal.investmentTypeName}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <GoalDialog
                    mode="edit"
                    investmentTypes={investmentTypeOptions}
                    goal={{
                      id: goal.id,
                      name: goal.name,
                      targetAmount: goal.targetAmount,
                      targetDate: goal.targetDate,
                      investmentTypeId: goal.investmentTypeId,
                    }}
                  />
                  <DeleteButton
                    onDelete={async () => {
                      'use server'
                      await deleteGoal(goal.id)
                    }}
                  />
                </div>
              </div>

              {/* Progresso */}
              <div className="mt-3 space-y-1.5">
                <Progress
                  value={goal.currentBalance}
                  max={goal.targetAmount}
                  indicatorClassName={isComplete ? 'bg-positive' : undefined}
                />
                <div className="flex items-center justify-between text-caption text-text-secondary">
                  <span className="tabular-nums">
                    <SensitiveAmount value={goal.currentBalance} /> de{' '}
                    <SensitiveAmount value={goal.targetAmount} />
                  </span>
                  <span className="font-medium tabular-nums">
                    {goal.progress.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Datas */}
              <div className="mt-2 flex flex-wrap gap-4 text-caption text-text-secondary">
                {goal.targetDate && (
                  <span>Prazo: {formatMonthName(goal.targetDate.slice(0, 7))}</span>
                )}
                {!isComplete && goal.projectedCompletionYearMonth && (
                  <span>
                    Projeção: {formatMonthName(goal.projectedCompletionYearMonth)}
                  </span>
                )}
              </div>
            </div>

            {/* Aportes manuais */}
            {!goal.investmentTypeId && (
              <>
                <Separator />
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium text-text-secondary">Aportes</span>
                    <ContributionDialog goalId={goal.id} />
                  </div>

                  {goal.contributions.length > 0 && (
                    <table className="w-full text-small">
                      <thead>
                        <tr className="text-caption text-text-secondary">
                          <th className="pb-1.5 text-left font-medium">Mês</th>
                          <th className="pb-1.5 text-right font-medium">Valor</th>
                          <th className="pb-1.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {goal.contributions.map((c) => (
                          <tr key={c.id}>
                            <td className="py-1.5 text-text-secondary">
                              {formatMonthName(referenceMonthToYearMonth(c.referenceMonth))}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">
                              <SensitiveAmount value={c.amount} />
                            </td>
                            <td className="py-1.5 pl-2">
                              <div className="flex items-center gap-1">
                                <ContributionEditButton contribution={c} />
                                <DeleteButton
                                  onDelete={async () => {
                                    'use server'
                                    await deleteGoalContribution(c.id)
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Atualizar metas/page.tsx**

Em `app/(app)/metas/page.tsx`:

**2a — importar novos componentes:**
```tsx
import { PrivacyToggle } from '@/components/providers/PrivacyMode'
import { MetasList } from '@/components/metas/MetasList'
```

**2b — substituir o bloco da lista (que começa em `<div className="space-y-4">`) para usar MetasList e adicionar PrivacyToggle ao header:**
```tsx
return (
  <PageLayout>
    <div className="flex items-start justify-between gap-4">
      <PageHeader title="Metas" description="Acompanhe o progresso das suas metas financeiras." />
      <PrivacyToggle />
    </div>

    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-label font-semibold text-text-secondary">Suas metas</h2>
        <GoalDialog mode="create" investmentTypes={investmentTypeOptions} />
      </div>

      <MetasList goals={goalsData} investmentTypeOptions={investmentTypeOptions} />
    </div>
  </PageLayout>
)
```

Remover imports não mais usados de `metas/page.tsx`: `formatCurrency`, `formatMonthName`, `referenceMonthToYearMonth`, `Progress`, `Badge`, `EmptyState`, `Separator`, `ContributionDialog`, `ContributionEditButton`, `DeleteButton`, `deleteGoal`, `deleteGoalContribution` (todos movidos para MetasList).

- [ ] **Step 3: Teste manual**

1. Navegar para `/metas`
2. Ativar modo privado → `currentBalance` e `targetAmount` de cada meta e contribuições mascarados
3. Percentuais de progresso permanecem visíveis

- [ ] **Step 4: Commit**

```bash
git add components/metas/MetasList.tsx app/\(app\)/metas/page.tsx
git commit -m "feat(privacy): mask sensitive values in metas"
```

---

## Task 7: Panorama

**Files:**
- Modify: `components/panorama/AnnualSummaryCards.tsx`
- Create: `components/panorama/PanoramaTable.tsx`
- Modify: `app/(app)/panorama/page.tsx`

**Interfaces:**
- Consumes: `SensitiveAmount`, `PrivacyToggle`, `usePrivacyMode` de `@/components/providers/PrivacyMode`
- Produces: `PanoramaTable({ overview, totalIncomes, totalExpensesYTD, totalInvested, finalBalance })`

- [ ] **Step 1: Converter AnnualSummaryCards para client + usar SensitiveAmount**

Em `components/panorama/AnnualSummaryCards.tsx`, adicionar `'use client'` na primeira linha e importar:

```tsx
'use client'

import { SensitiveAmount, usePrivacyMode } from '@/components/providers/PrivacyMode'
```

Remover import de `formatCurrency` e `formatCurrencyShort`.

**1a — Saldo do Ano (hero card):**
```tsx
// De:
<p className="mt-2 text-hero tabular-nums">{formatCurrency(balance)}</p>
// Para:
<p className="mt-2 text-hero tabular-nums"><SensitiveAmount value={balance} /></p>
```

**1b — `MetricCard` — prop `value`:** `MetricCard` recebe `value: number` e chama `formatCurrency(value)`. Adicionar `usePrivacyMode` em `MetricCard` e substituir:
```tsx
function MetricCard({ label, value, pct, variant, accentClass, year, footer }: MetricCardProps) {
  const { isPrivate } = usePrivacyMode()
  return (
    // ...
    <p className="mt-2 text-amount tabular-nums"><SensitiveAmount value={value} /></p>
    // ...
    <p className="mt-3 text-caption text-text-tertiary">{isPrivate ? '—' : footer}</p>
  )
}
```

O `footer` contém `formatCurrencyShort` calls. Ao mascarar, substituir por `'—'` para simplicidade.

**1c — Remover os imports de `formatCurrencyShort` e `formatCurrency` dos locais onde `footer` é construído nos callers** (`MetricCard` chamadas em `AnnualSummaryCards`). Na prática: os footers passados como props para `MetricCard` ainda usam `formatCurrencyShort` nos callers dentro de `AnnualSummaryCards`. Essas strings são construídas no escopo de `AnnualSummaryCards`, que agora é client. Isso é válido — o `formatCurrencyShort` continua no bundle client. Manter esses footers como estão; o mascaramento acontece em `MetricCard` com `isPrivate ? '—' : footer`.

- [ ] **Step 2: Criar PanoramaTable.tsx**

Criar `components/panorama/PanoramaTable.tsx` extraindo a `<Card>` com a tabela mensal de `panorama/page.tsx`:

```tsx
'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { cn } from '@/lib/utils/cn'
import { formatMonthAbbr } from '@/lib/utils/date'

type MonthRow = {
  month: string
  totalIncomes: number
  totalExpenses: number
  totalInvested: number
  balance: number
}

export function PanoramaTable({
  overview,
  totalIncomes,
  totalExpensesYTD,
  totalInvested,
  finalBalance,
}: {
  overview: MonthRow[]
  totalIncomes: number
  totalExpensesYTD: number
  totalInvested: number
  finalBalance: number
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b bg-bg-muted">
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Mês</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Entradas</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Gastos</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Investimentos</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {overview.map((row) => (
              <tr key={row.month} className="border-b last:border-0 hover:bg-bg-muted">
                <td className="px-4 py-3 font-medium">{formatMonthAbbr(row.month)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-positive-text">
                  <SensitiveAmount value={row.totalIncomes} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-negative-text">
                  <SensitiveAmount value={row.totalExpenses} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-accent-text">
                  <SensitiveAmount value={row.totalInvested} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-medium tabular-nums',
                    row.balance >= 0 ? 'text-positive-text' : 'text-negative-text'
                  )}
                >
                  <SensitiveAmount value={row.balance} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-bg-muted font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-positive-text">
                <SensitiveAmount value={totalIncomes} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-negative-text">
                <SensitiveAmount value={totalExpensesYTD} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-accent-text">
                <SensitiveAmount value={totalInvested} />
              </td>
              <td
                className={cn(
                  'px-4 py-3 text-right tabular-nums',
                  finalBalance >= 0 ? 'text-positive-text' : 'text-negative-text'
                )}
              >
                <SensitiveAmount value={finalBalance} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="divide-y md:hidden">
        {overview.map((row) => (
          <div key={row.month} className="px-4 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-small font-semibold">{formatMonthAbbr(row.month)}</span>
              <span
                className={cn(
                  'text-small font-medium tabular-nums',
                  row.balance >= 0 ? 'text-positive-text' : 'text-negative-text'
                )}
              >
                <SensitiveAmount value={row.balance} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-caption text-text-secondary">
              <div>
                <span className="block">Entradas</span>
                <span className="font-medium tabular-nums text-positive-text">
                  <SensitiveAmount value={row.totalIncomes} />
                </span>
              </div>
              <div>
                <span className="block">Gastos</span>
                <span className="font-medium tabular-nums text-negative-text">
                  <SensitiveAmount value={row.totalExpenses} />
                </span>
              </div>
              <div>
                <span className="block">Investido</span>
                <span className="font-medium tabular-nums text-accent-text">
                  <SensitiveAmount value={row.totalInvested} />
                </span>
              </div>
            </div>
          </div>
        ))}
        {/* Summary row on mobile */}
        <div className="bg-bg-muted px-4 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-small font-bold">Total</span>
            <span
              className={cn(
                'text-small font-bold tabular-nums',
                finalBalance >= 0 ? 'text-positive-text' : 'text-negative-text'
              )}
            >
              <SensitiveAmount value={finalBalance} />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-caption text-text-secondary">
            <div>
              <span className="block">Entradas</span>
              <span className="font-semibold tabular-nums text-positive-text">
                <SensitiveAmount value={totalIncomes} />
              </span>
            </div>
            <div>
              <span className="block">Gastos</span>
              <span className="font-semibold tabular-nums text-negative-text">
                <SensitiveAmount value={totalExpensesYTD} />
              </span>
            </div>
            <div>
              <span className="block">Investido</span>
              <span className="font-semibold tabular-nums text-accent-text">
                <SensitiveAmount value={totalInvested} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Atualizar panorama/page.tsx**

Em `app/(app)/panorama/page.tsx`:

**3a — importar:**
```tsx
import { PrivacyToggle } from '@/components/providers/PrivacyMode'
import { PanoramaTable } from '@/components/panorama/PanoramaTable'
```

**3b — adicionar PrivacyToggle ao bloco de botões existente:**
```tsx
// De:
<div className="flex flex-shrink-0 items-center gap-2">
  <YearSelector years={years} selected={year} />
  <Button variant="outline" size="sm" disabled leftIcon={<Download className="h-4 w-4" />}>
    <span className="hidden sm:inline">Exportar</span>
  </Button>
</div>
// Para:
<div className="flex flex-shrink-0 items-center gap-2">
  <PrivacyToggle />
  <YearSelector years={years} selected={year} />
  <Button variant="outline" size="sm" disabled leftIcon={<Download className="h-4 w-4" />}>
    <span className="hidden sm:inline">Exportar</span>
  </Button>
</div>
```

**3c — substituir o `<Card>` com a tabela mensal pelo `<PanoramaTable>`:**
```tsx
// De: <Card> ... tabela mensal completa ... </Card>
// Para:
<Card>
  <div className="px-5 py-4">
    <h2 className="text-body font-semibold text-text-primary">Tabela mensal</h2>
  </div>
  <PanoramaTable
    overview={overview}
    totalIncomes={totalIncomes}
    totalExpensesYTD={totalExpensesYTD}
    totalInvested={totalInvested}
    finalBalance={finalBalance}
  />
</Card>
```

Remover o import de `formatCurrency` de `panorama/page.tsx` e `cn` se não forem mais usados (verificar resto do arquivo — `cn` pode ser usado em outros lugares).

- [ ] **Step 4: Teste manual**

1. Navegar para `/panorama`
2. Ativar modo privado → `AnnualSummaryCards` e tabela mensal mascarados; footers de MetricCard mostram `—`
3. PrivacyToggle no header funciona
4. Percentuais de variação (ex: `+12%`) permanecem visíveis

- [ ] **Step 5: Rodar lint e typecheck final**

```bash
npm run lint && npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/panorama/AnnualSummaryCards.tsx \
  components/panorama/PanoramaTable.tsx \
  app/\(app\)/panorama/page.tsx
git commit -m "feat(privacy): mask sensitive values in panorama"
```

---

## Checklist de spec coverage

- [x] Provider com localStorage persistence → Task 1 + Task 2
- [x] Toggle em SettingsDialog → Task 2
- [x] Toggle nos headers das 5 páginas → Tasks 3–7
- [x] Dashboard mascarado (SummaryCards, listas, badges) → Task 3
- [x] Histórico mascarado → Task 4
- [x] Investimentos mascarado (hero, cards, resgates) → Task 5
- [x] Metas mascarado (currentBalance, targetAmount, contribuições) → Task 6
- [x] Panorama mascarado (AnnualSummaryCards, tabela mensal) → Task 7
- [x] Percentuais NÃO mascarados → implementado por design em todos os componentes
- [x] Hydration-safe (state inicia false, sincroniza em useEffect) → Task 1
