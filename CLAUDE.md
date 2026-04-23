# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # apply pending migrations to the database
npm run db:studio    # open Drizzle Studio (DB browser)
```

No test runner is configured.

## Environment

Required in `.env.local`:
```
DATABASE_URL=          # Neon connection string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

## Architecture

**Maré** is a personal finance app (Next.js 14, App Router) that tracks transactions, fixed expenses, installments, investments, and budgets per reference month.

### Route structure

- `app/(auth)/login` — unauthenticated entry point (Google OAuth via NextAuth)
- `app/(app)/` — authenticated shell; `layout.tsx` enforces session and renders `<Sidebar>` + `<BottomNav>` + `<RegistrationDialogProvider>`
- Pages: `dashboard`, `registro`, `categorias`, `configuracao-mes`, `parcelas`, `investimentos`, `metas`, `panorama`

### Data layer

- **Database**: Neon (PostgreSQL serverless), accessed via `lib/db/index.ts`
- **ORM**: Drizzle ORM — schema in `lib/db/schema.ts`, migrations in `lib/db/migrations/`
- **Queries** (`lib/queries/`): server-side read functions, called directly from async Server Components
- **Actions** (`lib/actions/`): `"use server"` functions for mutations; each calls `auth()` to get `userId`, performs the DB operation, then calls `revalidatePath`

### Auth

`lib/auth.ts` — NextAuth v4 with Google provider and Drizzle adapter. JWT strategy. `session.user.id` is populated from `token.sub` in the session callback. Use `auth()` helper to get the session in Server Components and actions.

### Key domain concepts

- All financial data is scoped per `userId` and per `referenceMonth` (always stored as `YYYY-MM-01`)
- Month params in URLs are `YYYY-MM`; use `lib/format.ts` helpers (`currentYearMonth`, `yearMonthToReferenceMonth`, `referenceMonthToYearMonth`, `prevMonth`, `nextMonth`) — never construct month strings manually
- Budget for a category is `category.defaultBudget` unless overridden by a `monthlyBudgetOverride` for that month
- An installment purchase creates one `installmentGroup` row and N `transaction` rows (one per month), named `"<name> (i/N)"`
- `paymentAccounts` has a `type` of `credit | debit | pix` and an optional `closingDay`
- Payment accounts are managed under `/categorias`, not a separate route

### Gotchas

- Dates are parsed with `T12:00:00` suffix (e.g. `new Date(dateStr + 'T12:00:00')`) to avoid UTC offset shifting the day when converting to `referenceMonth`
- `session.user.id` is not part of NextAuth's `Session` type; access it with `(session.user as any).id` — this pattern appears in every page and action

### UI

- Maré Design System em `components/ui/` — **não** é mais shadcn/ui genérico
- Recharts para charts (`components/charts/`)
- Tailwind CSS; tokens em `tailwind.config.ts` + CSS vars em `app/globals.css`
- Responsive layout: sidebar em `lg`, bottom nav em mobile

### Design System — Regras obrigatórias

**Antes de qualquer implementação de componente, leia estas regras.**

#### 1. Um componente por arquivo
Cada primitivo vai no seu próprio arquivo. Nunca juntar dois componentes independentes no mesmo arquivo.
- `badge.tsx` → só Badge
- `chip.tsx` → só Chip
- `input.tsx` → só Input
- `textarea.tsx` → só Textarea

#### 2. Componentes compostos usam os primitivos do DS
Componentes avançados que combinam primitivos **devem importar e usar os componentes do DS**, não duplicar HTML/classes.
- `field.tsx` usa `<Label>` — não `<label>` HTML direto
- `currency-input.tsx` compartilha `inputBase`/`inputErrorCls` de `input.tsx` — não duplica strings
- `delete-button.tsx` usa `<Button>` — não `<button>` HTML direto

#### 3. Apenas tokens nomeados — zero valores arbitrários
Proibido usar valores entre colchetes (`[...]`) para tokens que já existem no sistema.

**Tipografia** — usar apenas tokens do `tailwind.config.ts`:
`text-display` `text-h1` `text-h2` `text-h3` `text-body-lg` `text-body` `text-small` `text-caption` `text-label` `text-amount`

**Espaçamento** — grid de 4px do Tailwind: `p-1` (4px) `p-2` (8px) `p-3` (12px) etc.
Sub-grid de 2px permitido para elementos compactos: `p-0.5` (2px) `p-1.5` (6px) `p-2.5` (10px)

**Cores** — tokens semânticos do DS:
`bg-base` `bg-surface` `bg-subtle` `bg-muted` / `text-primary` `text-secondary` `text-tertiary` `text-inverse` / `accent` `accent-hover` `accent-subtle` `accent-text` / `positive` `negative` `warning` / `border` `border-strong`

**Sombras** — `shadow-sm` `shadow-md` `shadow-lg` (mapeados para CSS vars)

**Bordas** — `border` (1px) ou `border-2` (2px). Não usar `border-[1.5px]`.

**Focus ring** — `focus:shadow-[0_0_0_3px_var(--ring-accent)]` ou `focus:shadow-[0_0_0_3px_var(--ring-negative)]` (CSS vars definidas em globals.css)

**Transições** — `duration-fast` (120ms) ou `duration-base` (200ms)

**Border radius** — `rounded-sm` (6px) `rounded-md` (10px) `rounded-lg` (16px) `rounded-xl` (20px) `rounded-full`

**Alturas de controles interativos** — `h-7` (28px) `h-8` (32px) `h-9` (36px) `h-11` (44px) `h-12` (48px) `h-14` (56px)

Se um valor não existir como token, **parar e discutir** antes de usar `[valor-arbitrário]`.

#### 4. Componentes de formulário — padrão obrigatório
- Sempre usar `<Field label="...">` em vez de `<div> + <Label>` manual
- `<Field>` já inclui label, hint e error — não recriar essa estrutura
- Nunca usar `<label>` HTML direto em componentes de formulário

#### 5. Shared UI components — inventário atual

| Arquivo | Componente(s) | Uso |
|---|---|---|
| `button.tsx` | `Button` | Variantes: `primary` `secondary` `outline` `ghost` `danger` `positive` |
| `badge.tsx` | `Badge` | Variantes: `positive` `negative` `accent` `warning` `muted` |
| `chip.tsx` | `Chip` | Toggle com prop `active` |
| `input.tsx` | `Input` | Prop `error` disponível |
| `textarea.tsx` | `Textarea` | Prop `error` disponível |
| `field.tsx` | `Field` | Props: `label` `hint` `error` `required` |
| `label.tsx` | `Label` | Padrão: `text-caption font-medium text-text-secondary` |
| `select.tsx` | `Select` + primitivos Radix | Mesmo height que Input (`h-12`) |
| `currency-input.tsx` | `CurrencyInput` | Prop `error` disponível |
| `delete-button.tsx` | `DeleteButton` | Confirmação inline. **Nunca** criar botão de delete ad-hoc |

Re-exports são proibidos: se um componente precisa ser compartilhado, mova para `components/ui/` e atualize todos os imports.

## Context Engineering (Main Agent Discipline)

The main agent is an **orchestrator**, not an executor.

**Main agent role:** Coordinate files, spawn sub-agents, process summaries, communicate with the user.

**The main agent NEVER:** Broadly explores the codebase, implements code changes, runs builds/tests, or processes large command outputs. All of that is delegated to sub-agents.

### Sub-agent Communication Protocol

- Every prompt ends with: "Return a structured summary: [exact fields]"
- Never ask a sub-agent to "return everything"
- Target: 10–20 lines of actionable information per result
- Chain sub-agents: pass only the relevant fields between them
