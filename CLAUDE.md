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

- Antes de commitar: `npm run lint && npx prettier --check . && npx tsc --noEmit`
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
- Pages: `dashboard`, `registro`, `categorias`, `configuracao-mes`, `parcelas`, `investimentos`, `metas`, `panorama`, `devedores`

### Data layer

- **Database**: Neon (PostgreSQL serverless), accessed via `lib/db/index.ts`
- **ORM**: Drizzle ORM — schema in `lib/db/schema.ts`, migrations in `lib/db/migrations/`
- **Queries** (`lib/queries/`): server-side read functions, called directly from async Server Components
- **Actions** (`lib/actions/`): `"use server"` functions for mutations; each calls `auth()` to get `userId`, performs the DB operation, then calls `revalidatePath`
- **Dashboard queries** (`lib/queries/dashboard.ts`): `getMonthlyEvolution` usa `IN + GROUP BY` (4 queries para N meses — não voltar ao padrão N×4); totais do summary são calculados em JS a partir dos dados já buscados, sem queries `SUM` separadas; mesmo padrão aplicado em `panorama.ts` (`getAnnualOverview`)
- **`toAmount(val)`** em `lib/utils/currency.ts` — use em vez de `Number(x.amount)` em queries; centraliza a conversão de campos `decimal` do Drizzle (retornados como string)
- Indexes no schema Drizzle: terceiro parâmetro é função de array — `pgTable('t', { cols }, (t) => [index('name').on(t.col1, t.col2)])` — **não** usar sintaxe de objeto
- Unique indexes no schema: usar `uniqueIndex('name').on(t.col1, t.col2)` no mesmo array; na action correspondente, usar `.onConflictDoUpdate({ target: [table.col1, ...], set: { ... } })` — elimina o anti-padrão `existingId ? UPDATE : INSERT`; `.onConflictDoUpdate` retorna 500 em runtime se o unique index não existe no banco — rodar `npm run db:migrate` sempre que houver migrations pendentes antes de testar mutations

### Auth

`lib/auth.ts` — NextAuth v4 with Google provider and Drizzle adapter. JWT strategy. `session.user.id` is populated from `token.sub` in the session callback. Use `auth()` helper to get the session in Server Components and actions.

### Key domain concepts

- All financial data is scoped per `userId` and per `referenceMonth` (always stored as `YYYY-MM-01`)
- Month params in URLs are `YYYY-MM`; use `lib/utils/date.ts` helpers (`currentYearMonth`, `yearMonthToReferenceMonth`, `referenceMonthToYearMonth`, `prevMonth`, `nextMonth`, `billingCycleDateRange`) — never construct month strings manually
- `<input type="month">` retorna `YYYY-MM` — schemas de formulário com campo de mês devem usar `yearMonthSchema` de `lib/validations/utils.ts`; o formulário converte para `YYYY-MM-01` com `+ '-01'` ou `yearMonthToReferenceMonth()` antes de chamar a action, que usa `referenceMonthSchema`
- Budget for a category is `category.defaultBudget` unless overridden by a `monthlyBudgetOverride` for that month
- An installment purchase creates one `installmentGroup` row and N `transaction` rows (one per month), named `"<name> (i/N)"`
- `paymentAccounts` has a `type` of `credit | debit | pix` and an optional `closingDay`; when `closingDay > 1`, the dashboard shows a cycle select (`?cycleAccount=<uuid>`) that filters transactions and fixed expenses by that account's billing cycle — `closingDay` is derived from the account via `getCreditAccounts()`
- Payment accounts are managed under `/contas` (dedicated route); `/categorias` covers only category groups and categories
- Rota `/admin` protegida via `ADMIN_EMAIL` no `.env.local`; `app/(app)/layout.tsx` computa `isAdmin` e passa ao `<Sidebar>` para exibir o link condicionalmente
- Feature **devedores** usa duas tabelas: `people` (cadastro) + `debtorEntries` (lançamentos); `debtorEntries.type`: `charge` (débito, soma ao saldo) | `payment` (pagamento, subtrai) | `adjustment` (ajuste, também soma — nunca negativo por tipo); `balance > 0` = pessoa deve a você; `balance < 0` = você deve à pessoa (crédito)
- `debtorEntries.status`: `null` ou `'open'` = cobrança aberta; `'settled'` = quitada; `null`/`'open'` são equivalentes para toda lógica de UI e queries — charges pré-migration ficaram com `null`; `settledByPaymentId` aponta para o `debtor_entry` de `type='payment'` que quitou a charge
- `settleCharge` (Fluxo A) cria um payment com o valor exato da charge e marca `status='settled'` atomicamente via `db.transaction` — não permite quitação parcial; `createDebtPayment` aceita `settleChargeIds?: string[]` (Fluxo B) para vincular cobranças abertas no mesmo ato de registrar um pagamento manual
- Ao deletar um payment com charges vinculadas: `deleteDebtEntry` faz `UPDATE status='open', settledByPaymentId=null` **antes** de deletar o payment — a FK `ON DELETE SET NULL` limpa `settledByPaymentId` automaticamente mas **não** reseta `status`, por isso o UPDATE explícito é obrigatório
- `createDebtPayment` com `createIncome: true` cria um registro em `incomes` além do `debtorEntry` — mutation cross-domain que revalida `/dashboard` e `/panorama`; ao deletar o entry correspondente, passar `alsoDeleteIncome: true` para limpar o income vinculado
- `deletePersonIfEmpty` deleta pessoa somente se não houver `debtorEntries`; se houver histórico, usar `archivePerson` (seta `archived: true`) — regra de negócio explícita não refletida no schema

### Gotchas

- Dates are parsed with `T12:00:00` suffix (e.g. `new Date(dateStr + 'T12:00:00')`) to avoid UTC offset shifting the day when converting to `referenceMonth`
- `session.user.id` é tipado diretamente — `types/next-auth.d.ts` faz module augmentation do NextAuth; **nunca** usar `(session.user as { id: string }).id`
- Em actions, usar `const userId = await requireUserId()` de `@/lib/auth/require-user` — **não** criar `requireUserId` local em novos arquivos de action
- Ownership de IDs relacionados: importar `assertOwns*` de `@/lib/auth/ownership` antes de qualquer insert/update que referencie `categoryId`, `accountId`, `groupId`, `investmentTypeId`, `goalId`, `personId` ou `debtEntryId` vindo do cliente; quando a action já faz um SELECT antes de mutar, paralelizar os checks no mesmo `Promise.all`
- Ordem obrigatória em toda action com mutação: `requireUserId()` → `schema.parse(data)` → `assertOwns*` → query
- Schemas de amount em `lib/validations/utils.ts`: `positiveAmountSchema` (> 0) para transações/entradas/resgates/contribuições; `nonNegativeAmountSchema` (>= 0, obrigatório) para overrides de orçamento; `nullishNonNegativeAmountSchema` (>= 0, nullish) para aportes/rendimentos de investimento que aceitam zero
- Schemas de action vs formulário: quando o tipo do input da action tem campos `number` (ex: `dueDay`, `totalInstallments`) usar o schema `xxxActionSchema` definido no mesmo arquivo de validação — schemas sem sufixo são os de formulário com strings de FormData
- Hook `PostToolUse:Edit` do ESLint bloqueia edits com imports não usados (max-warnings 0); ao fazer múltiplas mudanças relacionadas num arquivo, usar `Write` para reescrever o arquivo inteiro em vez de encadear `Edit` calls
- Playwright `browser_take_screenshot` pode travar com timeout de fonte; solução: `browser_close` + `browser_navigate` para resetar o browser
- Após `db:generate`, rodar `npx prettier --write lib/db/migrations/meta/` antes de commitar — o pre-push hook rejeita a formatação gerada pelo Drizzle Kit
- Ao adicionar `uniqueIndex` em tabela existente: inserir `DELETE ... WHERE id NOT IN (SELECT DISTINCT ON (col1, col2) id FROM "tabela" ORDER BY col1, col2, id)` **antes** do `CREATE UNIQUE INDEX` na migration — evita falha se houver duplicatas (é no-op se não houver)
- Ao adicionar coluna de status/discriminador em tabela existente: `db:generate` não cria backfill — adicionar manualmente `UPDATE "tabela" SET "col" = 'valor' WHERE "condição"` após o último `statement-breakpoint` na migration gerada
- FK self-referente no Drizzle: importar `AnyPgColumn` de `drizzle-orm/pg-core` **sem** o modifier `type` (ESLint reporta false "unused" com `import { type AnyPgColumn }`) e usar função lazy: `settledByPaymentId: uuid('...').references((): AnyPgColumn => table.id, { onDelete: 'set null' })`
- `inArray(col, ids)` no Drizzle gera SQL inválido (`IN ()`) se `ids` for array vazio — sempre guardar com `if (ids.length > 0)` antes de chamar `inArray`
- `import { type X }` causa falso positivo "defined but never used" no ESLint (max-warnings 0) mesmo quando `X` é usada em anotação de tipo — importar sem o modifier `type`
- Mutações que escrevem em múltiplas tabelas ou linhas relacionadas devem usar `db.transaction(async (tx) => { ... })` — substituir `db` por `tx` dentro do callback; garante rollback atômico se qualquer step falhar
- Queries `findFirst` dentro de `db.transaction` retornam `null` silenciosamente — sempre verificar null e lançar erro explícito; nunca usar `?.` quando o dado é obrigatório para o passo seguinte (ex: person?.name produz string vazia e o insert prossegue corrompido)
- Condições `OR … IS NULL` no Drizzle: usar `or(eq(col, val), isNull(col))` de `drizzle-orm` em vez de `sql` template literal — helpers tipados, sem risco de interpolação errada
- Dialogs de mutação: fechar somente no caminho feliz (`try`), nunca no `catch` — `onOpenChange(false)` no catch faz o usuário perder contexto e ter que reabrir o dialog para tentar novamente
- Em dialogs com estado acumulado (selectedIds, amounts), o botão "Cancelar" deve chamar `handleOpenChange(false)`, não `setOpen(false)` direto — `handleOpenChange` é responsável pelo cleanup de estado; chamar `setOpen` diretamente pula o reset
- A tela de login renderiza `<LoginButton>` duas vezes (layout mobile + desktop); ao clicar via Playwright, usar `browser_evaluate` com filtro `offsetParent !== null` para acertar o visível
- O botão `+` do bottom nav (`aria-label="Novo lançamento"`) trava com `browser_click`; usar `browser_evaluate` com `querySelector`+`click()` para abrir o drawer de registro
- Segmented controls onde cada opção tem cor active diferente por tipo semântico (ex: negative/positive/accent): usar raw `<button>` em vez de `Chip`/`Segment` — os primitivos do DS não suportam active color variável por item
- `Segment` com muitas tabs em mobile: envolver com `<div className="overflow-x-auto">`, passar `className="flex w-full min-w-max"` ao Segment e chamar `e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })` no `onClick` de cada botão
- Para testar a tela de login, faça logout via `GET /api/auth/signout` (cookies NextAuth são HttpOnly, não limpam via JS)
- Playwright — múltiplos `button[aria-label="Ações"]` numa lista causam strict mode violation; usar `button[aria-label="Ações"] >> nth=0` ou `.nth(0)` para selecionar o kebab de uma linha específica
- Playwright — `browser_evaluate` com `element.click()` **não** abre Radix dropdowns (Radix intercepta eventos sintéticos); usar `browser_click` com seletor específico
- Playwright — múltiplos elementos com o mesmo texto visível em formulários (ex: "Registrar" aparece no dialog e nos botões do fundo): usar `button[type="submit"]` para atingir o botão de submit sem strict mode violation
- `incomes` não tem `categoryId` — categorias são exclusivas de despesas (saída); não exibir `CategoryPicker` para outros tipos de transação
- Radix `<Select>` não popula `FormData` — leia o valor via `onValueChange` + `useState`, nunca via `e.target` ou `FormData`
- `RadixSelect.Item` não aceita `value=""` (runtime error) — usar string sentinel não-vazia (ex: `"month"`) para opção padrão/limpar e checar por ela no `onValueChange`
- Padrão responsivo para dialogs de confirmação/entrada: `<Dialog>` em desktop (`lg+`) + `<Drawer>` em mobile — ver `DeleteButton` e `InvestmentEntryDialog` como referência; ao converter: remover `DialogTrigger` e usar botão standalone com `onClick={() => setOpen(true)}`; extrair JSX do formulário em `const form = (...)` compartilhado entre os dois branches
- `TransactionEditButton`, `IncomeEditButton`, `FixedExpenseEditButton`, `InvestmentEntryDialog` aceitam `open`/`onOpenChange` opcionais para controle externo — quando fornecidos, não renderizam o botão trigger
- Subtítulo de linha de lista (categoria + conta): usar `flex min-w-0 items-center gap-1.5 overflow-hidden` na div e `truncate` no último span para evitar quebra em múltiplas linhas
- Layout padrão de linha de lista: `icon/avatar | body (flex-1 min-w-0) | value (flex-shrink-0) | RowActions` — ações sempre na última coluna
- `signOut({ callbackUrl: '/login' })` redireciona para `NEXTAUTH_URL + callbackUrl` — em dev com porta alternativa (ex: 3001), vai para a porta do `NEXTAUTH_URL` (3000); comportamento esperado
- `@radix-ui/react-dropdown-menu` já está instalado (usado em `row-actions.tsx`); para dropdowns que abrem para cima, usar `side="top"` no `DropdownMenu.Content`
- `CurrencyInput` e `NumericInput` submetem `''` no hidden input quando o valor é 0; para permitir 0 como entrada legítima, passar `preserveExplicitZero` ao componente — campos de orçamento e aportes que aceitam zero devem sempre incluir essa prop
- `app/(app)/layout.tsx` aplica `px-4 py-6 lg:px-8 lg:py-7` + `pb-20 lg:pb-0` — páginas **não** devem adicionar wrapper próprio com padding; usar `PageLayout` diretamente
- Header de página com botões de ação: `<div className="flex items-start justify-between gap-4">` envolvendo `<PageHeader>` + div de ações, como primeiro filho de `<PageLayout>`
- `RowActions` aceita `onEdit` e `onDelete` opcionais — quando omitidos, "Editar" e "Excluir" não aparecem no dropdown respectivamente; aceita também `triggerClassName` para sobrescrever o hover do botão kebab quando está sobre fundo colorido (ex: `hover:bg-warning-subtle` em linhas pendentes); aceita `additionalActions?: Array<{ label: string; icon?: LucideIcon; onClick: () => void; variant?: 'default' | 'destructive' }>` para ações extras renderizadas antes do separador de Editar/Excluir — o componente controla a renderização para manter coerência visual; quando o dialog de confirmação precisa de UI customizada (ex: toggle "excluir income vinculado"), usar `additionalActions` com `variant: 'destructive'` em vez de `onDelete` — o `onClick` abre o dialog externo e o `RowActions` não renderiza confirmação built-in
- `RowActions` requer `group` na div da row pai — sem ele o botão kebab fica `opacity-0` no desktop e nunca aparece (`lg:group-hover:opacity-100` depende do ancestral com `group`)
- Para abrir dialog via `RowActions`: adicionar `open`/`onOpenChange` ao dialog e controlar com `useState` no pai; server components com inline `'use server'` que precisam de state devem ser convertidos para `'use client'` (importar server actions de `lib/actions/` normalmente)
- `drizzle-orm/neon-http` não suporta `db.transaction()` — trocar para `drizzle-orm/neon-serverless` com `Pool` de `@neondatabase/serverless` (já instalado); Node.js 18+ tem WebSocket nativo, sem precisar configurar `neonConfig`; verificar que nenhuma rota usa `export const runtime = 'edge'` antes de trocar
- `nextjs-toploader` instalado no root layout (`app/layout.tsx`) para feedback imediato de navegação; links dentro de `Dialog`/`Drawer` de menu não são prefetchados pelo Next.js porque ficam fora do viewport — navegações via menu sempre buscam RSC fresh e mostram `loading.tsx` após o threshold do `startTransition`
- `formatCurrencyShort(value)` em `lib/utils/currency.ts` — produz "R$ 42,9k" / "R$ 1,2M"; usar em footers de card, chips e projeções onde o valor completo (`formatCurrency`) não cabe
- Comparações YTD no panorama: ao calcular percentuais de variação vs. ano anterior, filtrar `prevOverview` pelos meses ativos do ano atual — comparar Jan–Mai do ano atual com Jan–Mai do anterior, nunca com o ano inteiro anterior; usar `.slice(5)` para extrair só o `MM` antes de montar o Set: `new Set(active.map((m) => m.month.slice(5)))` e `prevOverview.filter((m) => activeMonthKeys.has(m.month.slice(5)))` — strings `"YYYY-MM"` de anos diferentes nunca casam num Set lookup cruzado (`"2025-01"` não bate com `"2024-01"`)
- `getAnnualOverview` retorna todos os 12 meses inclusive futuros; parcelas criam `totalExpenses > 0` em meses ainda não ocorridos — ao derivar `activeMonths` (meses já ocorridos), usar comparação de data: `overview.filter((m) => m.month <= currentYearMonth())` — **nunca** usar `m.totalIncomes > 0` como filtro, pois quebra quando não há receitas no ano (cenário real: só parcelas); métricas de proporção (ex: `% da receita`) são imunes ao problema por serem razão entre somas
- Média mensal de investimentos no panorama: usar `monthsWithInvestment` (`overview.filter(m => m.totalInvested > 0).length`) como divisor — não `monthsElapsed`; meses sem aporte não devem deflacionar a média
- Seletor de anos disponíveis no Drizzle: usar `sql<number>\`EXTRACT(YEAR FROM ${col})::int\`` com `selectDistinct` em cada tabela relevante, juntar os arrays, deduplicar com `new Set(...)` e ordenar — retornar `[currentYear()]` como fallback se não houver dados; ver `getAvailableYears` em `lib/queries/panorama.ts`
- Cards de resumo do panorama anual devem cobrir o mesmo período — misturar all-time com período anual quebra a consistência de leitura (ex: 3 cards do ano + 1 card all-time confunde o usuário ao comparar valores)
- Saldo do panorama (`balance` e `prevBalance` em `AnnualSummaryCards`): sempre subtrair investimentos — `income - expenses - invested`; omitir infla o saldo visível (usuário vê R$ 10k mas R$ 7k já foram para investimentos); `taxaPoupanca` deriva de `balance` e portanto representa caixa real após tudo, não "tudo que não foi gasto em despesas"
- Tipo de retorno de query Drizzle sem export explícito: usar `export type X = Awaited<ReturnType<typeof fn>>[number]` logo após a função — evita redefinir interface no componente e mantém tipos sincronizados automaticamente quando a query muda de shape

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
`text-hero` (40px) `text-display` `text-h1` `text-h2` `text-h3` `text-body-lg` `text-body` `text-small` `text-caption` `text-label` `text-amount`

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
- `Section` (DS) aceita `action?: ReactNode` — passar `<Badge variant="..." size="sm">` ou span de texto para contagens/totais; nunca criar `Section` local com prop `count`; blocos com `rounded-lg border bg-bg-surface shadow-sm` próprio são cards, não seções — manter como `<section>` HTML
