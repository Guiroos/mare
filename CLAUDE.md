# CLAUDE.md

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # apply pending migrations to the database
npm run db:studio    # open Drizzle Studio (DB browser)
npm run lint         # run ESLint (next lint)
```

- Antes de commitar: `npm run lint && npm run format:check && npm run typecheck && npm test`
- `npm run build` não executa migrations; Vercel usa `npm run db:migrate && npm run build` via `vercel.json`

Testes unitários: `npm test` / `npm test:watch` / `npm run test:coverage` (Vitest, `__tests__/unit/`). Integração com banco real: `npm run test:integration` (requer `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID`). Playwright MCP disponível para iteração de UI em tempo real.

**Coverage:** ao cobrir arquivo em `lib/utils/` ou `lib/validations/` com >= 80%, adicionar entrada em `thresholds.perFile` no `vitest.config.ts`. Nunca definir abaixo do já conquistado.

## Environment

```
DATABASE_URL=          # Neon connection string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
BLOCK_SIGNIN=          # opcional; "true" bloqueia novos cadastros (usuários existentes continuam entrando)
```

## Architecture

**Maré** é um app de finanças pessoais (Next.js 14, App Router) que rastreia transações, gastos fixos, parcelas, investimentos e orçamentos por mês de referência.

### Routes

- `app/(auth)/login` — entry point (Google OAuth via NextAuth)
- `app/(app)/` — shell autenticado; `layout.tsx` renderiza `<Sidebar>` + `<BottomNav>` + `<RegistrationDialogProvider>`
- Pages: `dashboard`, `registro`, `categorias`, `configuracao-mes`, `parcelas`, `investimentos`, `metas`, `panorama`, `devedores`

### Data layer

- **DB**: Neon PostgreSQL via `lib/db/index.ts`. ORM: Drizzle — schema em `lib/db/schema.ts`, migrations em `lib/db/migrations/`
- **Queries** (`lib/queries/`): lidas direto em Server Components. **Actions** (`lib/actions/`): `"use server"`, mutam e chamam `revalidatePath`
- `toAmount(val)` em `lib/utils/currency.ts` — sempre usar em vez de `Number(x.amount)`; campos `decimal` do Drizzle retornam string
- Dashboard/panorama: totais calculados em JS dos dados já buscados, sem queries `SUM` separadas; `getMonthlyEvolution` usa `IN + GROUP BY` (4 queries fixas — não N×4)
- Gotchas de schema, migrations e Drizzle: **@.claude/db.md**

### Auth

NextAuth v4, Google provider, Drizzle adapter, JWT. Padrões de action e ownership: **@.claude/auth.md**

### Domain concepts

- Todos os dados financeiros escopados por `userId` + `referenceMonth` (sempre `YYYY-MM-01`)
- Meses em URLs são `YYYY-MM`; usar helpers de `lib/utils/date.ts` — nunca construir strings de mês manualmente
- `<input type="month">` retorna `YYYY-MM` — schemas de formulário usam `yearMonthSchema`; converter para `YYYY-MM-01` antes de chamar a action (`referenceMonthSchema`)
- Budget por categoria: `category.defaultBudget` ou override via `monthlyBudgetOverride` para o mês
- Parcela: 1 `installmentGroup` + N `transaction` rows (`"<name> (i/N)"`); `closingDay` da conta define se a 1ª parcela pertence ao mês atual ou seguinte — usar `calcBaseReferenceMonth`/`calcInstallmentDate` em `lib/utils/date.ts`; `closingDay <= 1` é tratado como calendário
- `paymentAccounts.type`: `credit | debit | pix`; quando `closingDay > 1`, dashboard exibe cycle select (`?cycleAccount=`)
- Contas gerenciadas em `/contas`; `/categorias` cobre apenas grupos e categorias
- Rota `/admin` protegida via `ADMIN_EMAIL` no `.env.local`

**Regime fatura:**
- `userSettings.creditMode` (`'accrual'` | `'fatura'`); `faturaActiveFrom` (`YYYY-MM-01`)
- Contas de crédito precisam de `closingDay > 1`; pagamento de fatura é `transaction` com `faturaAccountId` + `faturaCycleMonth`
- `FaturaContext` (`{ creditMode, faturaActiveFrom, creditAccountIds }`) é 3º argumento de `getDashboardData`, `getAnnualOverview`, `getAnnualExpensesByGroup` — construir no page level
- `isFaturaMode` e `isCycleView` são mutuamente exclusivos: `isFaturaMode = !isCycleView && creditMode === 'fatura'`
- Em fatura mode, `fixedForPendency` exclui gastos fixos de crédito das pendências; `unpaidFixedCount` e `pendingFixed` derivam de `fixedForPendency`
- `getUserCreditMode(userId)` nunca retorna null — default `{ creditMode: 'accrual', faturaActiveFrom: null }`

**Devedores:**
- `people` (cadastro) + `debtorEntries` (lançamentos); `type`: `charge` | `payment` | `adjustment`
- `balance > 0` = pessoa deve a você; `status` `null`/`'open'` são equivalentes (pré-migration ficaram como `null`)
- `settleCharge` (Fluxo A) é atômico via `db.transaction`; `createDebtPayment` aceita `settleChargeIds[]` (Fluxo B)
- Ao deletar payment: `UPDATE status='open'` **antes** do DELETE — `ON DELETE SET NULL` não reseta `status`
- `deletePersonIfEmpty` deleta; se houver histórico, usar `archivePerson` (archived: true)
- `createDebtPayment` com `createIncome: true` cria income — ao deletar, passar `alsoDeleteIncome: true`
- `pixKey` em `userSettings.pixKey`; `getUserPixKey(userId)` / `updatePixKey(pixKey | null)` (upsert por userId); exibido via `PixKeyCard` em `/devedores`
- `getOpenChargesForPeople(userId, personIds)` — variante batch de `getOpenChargesForPerson`; retorna `Record<string, OpenChargeForLinking[]>`; usar em list pages para evitar N queries por pessoa
- `CobrancaDialog` (`components/devedores/CobrancaDialog.tsx`): recebe `openCharges: OpenChargeForLinking[]` + `pixKey: string | null` + `onEditPhone?`; quando `person.phone` é null exibe botão "Copiar mensagem" em vez de "Abrir WhatsApp"; usa `buildDebtMessage(name, charges, pixKey)` e `formatPhoneForWhatsApp(phone)` de `lib/utils/`

**Investimentos:**
- `destination` em `investmentWithdrawals`: `'income'` = caixa (cria income); `'reinvest'` = rolagem (cria income com `investmentReturnCapital`); `'transfer'` = entre tipos (sem income)
- `deleteWithdrawal` remove income vinculado via `db.transaction`; nunca deletar income diretamente de um resgate
- `incomes.investmentReturnCapital` deve ser subtraído de `totalIncomes` em: `getDashboardData`, `getAnnualOverview`, `getMonthlyEvolution`
- `investmentTypes.goalId`: `ON DELETE SET NULL`; `goalContributions.goalId`: `ON DELETE CASCADE` (assimétrico)
- Saldo em JS: usar `Math.round(balance * 100)` para comparar com zero (float precision)
- `getPatrimonyTimeline` — `aporte` é capital líquido: desconta resgates brutos (`amount + taxAmount`); `PatrimonyHero` exibe `totalYield` só de tipos ativos

**Cron:**
- Neon não suporta `pg_cron`; jobs em `vercel.json` (`"crons": [{ "path": "...", "schedule": "..." }]`); autenticação via `Authorization: Bearer ${CRON_SECRET}`
- Rotas de cron não têm sessão — operam direto no `db`; usar `Promise.allSettled` por usuário
- `autoRolloverFixedExpenses` (cron, dia 1): pula se já há gastos fixos no mês; manual (`copyFixedExpensesFromPrevMonth`) substitui tudo

### Gotchas

- Datas: `new Date(dateStr + 'T12:00:00')` evita UTC shift ao converter para `referenceMonth`
- `dateSchema` faz overflow silencioso em datas inválidas (ex: 29/02 em não-bissexto) — não usar para validar precisão de calendário
- `transactions` tem check constraint: `(faturaAccountId IS NULL AND categoryId IS NOT NULL) OR vice-versa` — sempre passar `categoryId` em transações comuns
- `installmentGroups` FK é `set null`, mas semântica de produto é excluir tudo — `deleteInstallmentGroup` usa `db.transaction()`: transactions primeiro, depois o grupo
- **Panorama — activeMonths**: `overview.filter(m => m.month <= currentYearMonth())` — nunca `m.totalIncomes > 0`; tfoot usa `totalExpensesYTD`; saldo: `income - expenses - invested`; média de investimentos usa `monthsWithInvestment` como divisor
- Comparações YTD: filtrar `prevOverview` pelos meses ativos do ano atual (`.slice(5)` para extrair `MM` antes de montar o Set)
- `ESLint react-hooks/immutability`: `let` reassignment em callbacks — usar `for` loop ou `reduce` sem mutação de variável externa
- Next.js 16: `params`/`searchParams` são `Promise<>` — `await`; paralelizar com `auth()` via `Promise.all`
- `@serwist/next`: adicionar `turbopack: {}` vazio ao `next.config.mjs` (Turbopack + webpack coexistência)
- Hook `PostToolUse:Edit` bloqueia edits com imports não usados — usar `Write` para reescrever o arquivo inteiro quando há múltiplas mudanças
- Hook `PostToolUse:Write` também dispara ds-reviewer (não só `Edit`) — ao fazer múltiplas edições em arquivos de componente (ex: Sidebar, BottomNav), preferir um único `Write` completo a vários `Edit` para minimizar interrupções
- `error.tsx` em `app/(app)/` não captura erros lançados dentro do `layout.tsx` do mesmo nível (ex: falha no `auth()`, crash em `Sidebar`) — para isso é necessário `app/global-error.tsx`, que deve incluir `<html>` + `<body>` pois substitui o root layout
- Panorama e dashboard compartilham as mesmas fontes: `getAnnualOverview` soma `transactions` **e** `fixedExpenses` para despesas mensais — toda action com `revalidatePath('/dashboard')` por dado financeiro (incomes, transactions, fixedExpenses, investments, withdrawals) deve também chamar `revalidatePath('/panorama')`; exceção: budget overrides em `categories.ts` (panorama exibe amounts, não orçamentos)
- Feed cross-table por data: `fixedExpenses` não têm coluna `date` — buscar por `inArray(referenceMonth, referenceMonthsInRange(de, ate))` e JS-filtrar o date computado (`referenceMonth + dueDay - 1`) para excluir itens cujo `dueDay` os coloca fora do range exato

**UI:**
- `incomes` não tem `categoryId` — não exibir `CategoryPicker` para tipos não-despesa
- `app/(app)/layout.tsx` aplica padding global — páginas não adicionam wrapper próprio; usar `PageLayout` diretamente
- Header de página com ações: `<div className="flex items-start justify-between gap-4">` envolvendo `<PageHeader>` + ações
- Dialogs de mutação: fechar só no `try`, nunca no `catch`; botão "Cancelar" chama `handleOpenChange(false)`, não `setOpen(false)` (handleOpenChange faz cleanup de estado)
- Padrão responsivo: `<Dialog>` desktop (`lg+`) + `<Drawer>` mobile; ver `DeleteButton`/`InvestmentEntryDialog`
- `TransactionEditButton`, `IncomeEditButton`, `FixedExpenseEditButton`, `InvestmentEntryDialog`, `WithdrawalDialog` aceitam `open`/`onOpenChange` para controle externo
- `CurrencyInput`/`NumericInput`: passar `preserveExplicitZero` quando zero é valor legítimo (orçamentos, aportes)
- Radix `<Select>`: não popula `FormData` — usar `onValueChange` + state; `value=""` dá runtime error — usar sentinel não-vazio
- Filtro booleano via URL: chip/button `'use client'` com `useRouter`; chip de toggle permanece visível quando `active = true` mesmo com `count === 0`
- Client Component com paginação acumulada (load-more) em página com server nav: passar `key={filterCombo}` concatenando todos os filtros — força React a desmontar/remontar e resetar `useState` de items/cursor quando filtros mudam; sem isso, `initialItems` do server são ignorados e a lista acumulada permanece
- Input de busca que dispara `router.push`: usar `localQ` state para responsividade imediata + `useRef<ReturnType<typeof setTimeout>>` + `clearTimeout` + delay 400ms antes de chamar `navigate({ q: value })` — evita roundtrips excessivos ao servidor
- `RowActions` requer `group` na div pai; aceita `additionalActions`, `triggerClassName`, `onEdit`, `onDelete` opcionais
- `formatCurrencyShort(value)` em `lib/utils/currency.ts` — "R$ 42,9k" / "R$ 1,2M"; usar em footers/chips

**Playwright MCP:**
- `<LoginButton>` renderiza duas vezes (mobile + desktop) — filtrar com `offsetParent !== null` no `browser_evaluate`
- Botão `+` do bottom nav trava com `browser_click` — usar `browser_evaluate` + `querySelector`+`click()`
- `browser_evaluate` com `element.click()` não abre Radix dropdowns — usar `browser_click` com seletor específico
- Múltiplos `button[aria-label="Ações"]` — usar `>> nth=0`; múltiplos elementos com mesmo texto — usar `button[type="submit"]`
- `browser_take_screenshot` pode travar — `browser_close` + `browser_navigate` para resetar
- Logout para testar tela de login: `GET /api/auth/signout` (cookies são HttpOnly)

### UI / Design System

Componentes em `components/ui/` — DS Maré (não shadcn genérico). Recharts em `components/charts/`. Tokens em `tailwind.config.ts` + `app/globals.css`. Responsive: sidebar em `lg`, bottom nav em mobile.

Regras, tokens e inventário completo: **@.claude/ds-components.md**

**Dark mode:**
- Tema controlado via `next-themes` (`ThemeProvider` em `app/layout.tsx`); preferência salva em `localStorage`; toggle em `SettingsDialog` com opções Claro/Escuro/Sistema
- Vars de compatibilidade shadcn (`--background`, `--foreground`, `--card`, etc.) **não** precisam ser redeclaradas em `.dark {}` — são aliases que apontam para tokens Maré e herdam automaticamente
- Gráficos Recharts (`MonthlyEvolutionChart`, `ExpensePieChart`, `AnnualStackedChart`, `PatrimonyEvolutionChart`) usam cores hardcoded — não mudam com o tema (fase 2)
