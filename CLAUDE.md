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

- shadcn/ui components in `components/ui/` (Radix-based)
- Recharts for charts (`components/charts/`)
- Tailwind CSS; `tailwind-merge` + `clsx` via `lib/utils.ts`
- Responsive layout: sidebar on `lg`, bottom nav on mobile

## Context Engineering (Main Agent Discipline)

The main agent is an **orchestrator**, not an executor.

**Main agent role:** Coordinate files, spawn sub-agents, process summaries, communicate with the user.

**The main agent NEVER:** Broadly explores the codebase, implements code changes, runs builds/tests, or processes large command outputs. All of that is delegated to sub-agents.

### Sub-agent Communication Protocol

- Every prompt ends with: "Return a structured summary: [exact fields]"
- Never ask a sub-agent to "return everything"
- Target: 10–20 lines of actionable information per result
- Chain sub-agents: pass only the relevant fields between them
