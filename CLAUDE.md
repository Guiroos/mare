# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # apply pending migrations to the database
npm run db:studio    # open Drizzle Studio (DB browser)
npm run lint         # run ESLint (next lint)
```

- `npm run build` compila apenas o Next.js — **não** executa migrations; `vercel.json` define `buildCommand` com `npm run db:migrate && npm run build` para que o deploy na Vercel rode a migration automaticamente

Não há testes automatizados. Playwright MCP está disponível para desenvolvimento de UI em tempo real: inicie o dev server e use o MCP do Playwright para inspecionar e iterar nas telas no browser.

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
- **Dashboard queries** (`lib/queries/dashboard.ts`): `getMonthlyEvolution` usa `IN + GROUP BY` (4 queries para N meses — não voltar ao padrão N×4); totais do summary são calculados em JS a partir dos dados já buscados, sem queries `SUM` separadas; mesmo padrão aplicado em `panorama.ts` (`getAnnualOverview`)
- **`toAmount(val)`** em `lib/utils/currency.ts` — use em vez de `Number(x.amount)` em queries; centraliza a conversão de campos `decimal` do Drizzle (retornados como string)

### Auth

`lib/auth.ts` — NextAuth v4 with Google provider and Drizzle adapter. JWT strategy. `session.user.id` is populated from `token.sub` in the session callback. Use `auth()` helper to get the session in Server Components and actions.

### Key domain concepts

- All financial data is scoped per `userId` and per `referenceMonth` (always stored as `YYYY-MM-01`)
- Month params in URLs are `YYYY-MM`; use `lib/utils/date.ts` helpers (`currentYearMonth`, `yearMonthToReferenceMonth`, `referenceMonthToYearMonth`, `prevMonth`, `nextMonth`, `billingCycleDateRange`) — never construct month strings manually
- Budget for a category is `category.defaultBudget` unless overridden by a `monthlyBudgetOverride` for that month
- An installment purchase creates one `installmentGroup` row and N `transaction` rows (one per month), named `"<name> (i/N)"`
- `paymentAccounts` has a `type` of `credit | debit | pix` and an optional `closingDay`; when `closingDay > 1`, the dashboard shows a cycle select (`?cycleAccount=<uuid>`) that filters transactions and fixed expenses by that account's billing cycle — `closingDay` is derived from the account via `getCreditAccounts()`
- Payment accounts are managed under `/contas` (dedicated route); `/categorias` covers only category groups and categories
- Rota `/admin` protegida via `ADMIN_EMAIL` no `.env.local`; `app/(app)/layout.tsx` computa `isAdmin` e passa ao `<Sidebar>` para exibir o link condicionalmente

### Gotchas

- Dates are parsed with `T12:00:00` suffix (e.g. `new Date(dateStr + 'T12:00:00')`) to avoid UTC offset shifting the day when converting to `referenceMonth`
- `session.user.id` is not part of NextAuth's `Session` type; access it with `(session.user as any).id` — this pattern appears in every page and action
- Playwright `browser_take_screenshot` pode travar com timeout de fonte; solução: `browser_close` + `browser_navigate` para resetar o browser
- Após `db:generate`, rodar `npx prettier --write lib/db/migrations/meta/` antes de commitar — o pre-push hook rejeita a formatação gerada pelo Drizzle Kit
- A tela de login renderiza `<LoginButton>` duas vezes (layout mobile + desktop); ao clicar via Playwright, usar `browser_evaluate` com filtro `offsetParent !== null` para acertar o visível
- O botão `+` do bottom nav (`aria-label="Novo lançamento"`) trava com `browser_click`; usar `browser_evaluate` com `querySelector`+`click()` para abrir o drawer de registro
- Segmented controls onde cada opção tem cor active diferente por tipo semântico (ex: negative/positive/accent): usar raw `<button>` em vez de `Chip`/`Segment` — os primitivos do DS não suportam active color variável por item
- `Segment` com muitas tabs em mobile: envolver com `<div className="overflow-x-auto">`, passar `className="flex w-full min-w-max"` ao Segment e chamar `e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })` no `onClick` de cada botão
- Para testar a tela de login, faça logout via `GET /api/auth/signout` (cookies NextAuth são HttpOnly, não limpam via JS)
- `incomes` não tem `categoryId` — categorias são exclusivas de despesas (saída); não exibir `CategoryPicker` para outros tipos de transação
- Radix `<Select>` não popula `FormData` — leia o valor via `onValueChange` + `useState`, nunca via `e.target` ou `FormData`
- `RadixSelect.Item` não aceita `value=""` (runtime error) — usar string sentinel não-vazia (ex: `"month"`) para opção padrão/limpar e checar por ela no `onValueChange`
- Padrão responsivo para dialogs de confirmação/entrada: `<Dialog>` em desktop (`lg+`) + `<Drawer>` em mobile — ver `DeleteButton` e `InvestmentEntryDialog` como referência
- `TransactionEditButton`, `IncomeEditButton`, `FixedExpenseEditButton`, `InvestmentEntryDialog` aceitam `open`/`onOpenChange` opcionais para controle externo — quando fornecidos, não renderizam o botão trigger
- Subtítulo de linha de lista (categoria + conta): usar `flex min-w-0 items-center gap-1.5 overflow-hidden` na div e `truncate` no último span para evitar quebra em múltiplas linhas
- Layout padrão de linha de lista: `icon/avatar | body (flex-1 min-w-0) | value (flex-shrink-0) | RowActions` — ações sempre na última coluna
- `signOut({ callbackUrl: '/login' })` redireciona para `NEXTAUTH_URL + callbackUrl` — em dev com porta alternativa (ex: 3001), vai para a porta do `NEXTAUTH_URL` (3000); comportamento esperado
- `@radix-ui/react-dropdown-menu` já está instalado (usado em `row-actions.tsx`); para dropdowns que abrem para cima, usar `side="top"` no `DropdownMenu.Content`
- `CurrencyInput` e `NumericInput` submetem `''` no hidden input quando o valor é 0; para permitir 0 como entrada legítima, adicione estado `touched` no componente e emita o valor numérico quando `touched || cents > 0`

### UI

- Maré Design System em `components/ui/` — **não** é mais shadcn/ui genérico
- Recharts para charts (`components/charts/`)
- Custom React hooks em `hooks/`
- `.ds/` — pasta local (não versionada) com arquivos de referência visuais usados ao criar novas telas
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
`bg-bg-base` `bg-bg-surface` `bg-bg-input` `bg-bg-subtle` `bg-bg-muted` / `text-text-primary` `text-text-secondary` `text-text-tertiary` `text-text-inverse` / `accent` `accent-hover` `accent-subtle` `accent-text` / `positive` `negative` `warning` / `border` `border-strong`

**Sombras** — `shadow-sm` `shadow-md` `shadow-lg` (mapeados para CSS vars)

**Bordas** — `border` (1px) ou `border-2` (2px). Não usar `border-[1.5px]`.

**Focus ring** — `focus:shadow-[0_0_0_3px_var(--ring-accent)]` ou `focus:shadow-[0_0_0_3px_var(--ring-negative)]` (CSS vars definidas em globals.css)

**Transições** — `duration-fast` (120ms) ou `duration-base` (200ms)

**Border radius** — `rounded-sm` (6px) `rounded-md` (10px) `rounded-lg` (16px) `rounded-xl` (20px) `rounded-full`

**Alturas de controles interativos** — `h-7` (28px) `h-8` (32px) `h-9` (36px) `h-11` (44px) `h-12` (48px) `h-14` (56px)

Se um valor não existir como token, **parar e discutir** antes de usar `[valor-arbitrário]`.

`style={{}}` com gradientes `oklch(...)` complexos é aceitável em painéis de brand/decorativos quando não existe token equivalente — não é violação da Regra 3.

#### 4. Componentes de formulário — padrão obrigatório

- Sempre usar `<Field label="...">` em vez de `<div> + <Label>` manual
- `<Field>` já inclui label, hint e error — não recriar essa estrutura
- Nunca usar `<label>` HTML direto em componentes de formulário

#### 5. Shared UI components — inventário atual

@.claude/ds-components.md

**Ao adicionar um componente a `components/ui/`, atualize `.claude/ds-components.md`** — não edite o inventário aqui.

Re-exports são proibidos: se um componente precisa ser compartilhado, mova para `components/ui/` e atualize todos os imports.

- Formulários complexos: extrair sub-componentes de apresentação em `components/forms/<form>/` com `types.ts` para tipos compartilhados; consumidores importam os tipos direto de `types.ts`, não re-exportar pelo componente principal
- `Section` (DS) aceita `action?: ReactNode` — passar `<Badge variant="..." size="sm">` para contagens/totais; nunca criar `Section` local com prop `count`

### Gotchas de tokens e utilitários

- `twMerge` (em `lib/utils/cn.ts`) está configurado com `extendTailwindMerge` para reconhecer os tokens customizados de tipografia — sobreposições como `text-display` sobre `text-body` funcionam corretamente
- Modificador de opacidade `/N` (ex: `text-negative-text/60`) **não funciona** com CSS vars opacas (`oklch(...)`) — usar `opacity-N` no elemento em vez disso
- `bg-bg-input` não é gerado pelo Tailwind JIT (conflito com token shadcn `input:` na raiz do `colors`); a classe está declarada manualmente em `globals.css` via `@layer utilities` — não remover
- `SelectTrigger` (Radix) renderiza como `<button>`, que tem background cinza nativo do browser — sempre incluir `bg-bg-input` explicitamente no trigger
- Wrappers Radix (`SelectTrigger`, etc.): className **sempre** via `cn()` de `lib/utils/cn` — nunca template string com ternário
- `tabular-nums` obrigatório em qualquer elemento que exiba valor numérico em contexto de comparação (contagens, percentuais, totais — não só valores monetários)
