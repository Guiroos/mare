# CLAUDE.md

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # apply pending migrations to the database
npm run db:studio    # open Drizzle Studio (DB browser)
npm run lint         # eslint . --max-warnings 0
npm run typecheck    # tsc --noEmit
npm run db:dev:seed  # popula 6 meses de dados fake no 1º usuário do banco — APAGA os dados financeiros dele antes
```

- Antes de commitar: `npm run lint && npm run format:check && npm run typecheck && npm test`
- `npm run build` não executa migrations; Vercel usa `npm run db:migrate && npm run build` via `vercel.json`
- CI: testes de integração rodam **apenas em push para `main`**, não em PRs (job `integration` tem `if: github.event_name == 'push'`)

Testes unitários: `npm test` / `npm run test:watch` / `npm run test:coverage` (Vitest, `__tests__/unit/`). Integração com banco real: `npm run test:integration` (requer `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID`, `ENCRYPTION_MASTER_KEY`). Playwright MCP disponível para iteração de UI em tempo real. Gotchas de infra de testes (Vitest 4.x, neon-testing, dynamic import, factories): **@.claude/testing.md**

**Coverage:** ao cobrir arquivo em `lib/utils/` ou `lib/validations/` com >= 80%, adicionar entrada em `thresholds.perFile` no `vitest.config.mts`. Nunca definir abaixo do já conquistado.

## Environment

```
DATABASE_URL=          # Neon connection string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
BLOCK_SIGNIN=          # opcional; "true" bloqueia novos cadastros (usuários existentes continuam entrando)
ENCRYPTION_MASTER_KEY= # 64 hex chars (32 bytes); obrigatório em runtime e em testes de integração
ADMIN_EMAIL=           # libera /admin e updateFeedbackStatus
CRON_SECRET=           # Bearer das rotas em app/api/cron/
```

## Architecture

**Maré** é um app de finanças pessoais (Next.js 16, App Router) que rastreia transações, gastos fixos, parcelas, investimentos e orçamentos por mês de referência.

### Routes

- `app/(auth)/login` — entry point (Google OAuth via NextAuth)
- `app/(app)/` — shell autenticado; `layout.tsx` renderiza `<Sidebar>` + `<BottomNav>` + `<RegistrationDialogProvider>`
- Pages: `dashboard`, `registro`, `categorias`, `configuracao-mes`, `parcelas`, `investimentos`, `metas`, `panorama`, `devedores`, `historico`, `contas`, `viagens`, `admin`
- `app/(marketing)/` — landing pública + `privacidade`, `seguranca`, `termos` (sem providers de cliente)
- `app/(share)/e/[token]` — página pública de compartilhamento por token
- `app/api/export/{completo,extrato,devedores}` — exports; `app/api/cron/` — jobs agendados no `vercel.json`

### Data layer

- **DB**: Neon PostgreSQL via `lib/db/index.ts`. ORM: Drizzle — schema em `lib/db/schema.ts`, migrations em `lib/db/migrations/`
- **Queries** (`lib/queries/`): lidas direto em Server Components. **Actions** (`lib/actions/`): `"use server"`, mutam e chamam `revalidatePath`
- `toAmount(val)` em `lib/utils/currency.ts` — sempre usar em vez de `Number(x.amount)`; campos `decimal` do Drizzle retornam string, e valores cifrados chegam como string depois do `decryptField`. Vale também em componentes: `toAmount(undefined)` é `0`, `Number(undefined)` é `NaN`
- Dashboard/panorama: totais calculados em JS dos dados já buscados, sem queries `SUM` separadas
- Gotchas de schema, migrations e Drizzle: **@.claude/db.md**
- Criptografia de campos (MEK/DEK, API, gotchas de query): **@.claude/crypto.md**
- Regras de negócio por domínio: **@.claude/domain.md** | Fatura (billing cycle, modos, pagamento): **@.claude/domain-fatura.md**

### Auth

NextAuth v4, Google provider, Drizzle adapter, JWT. Padrões de action e ownership: **@.claude/auth.md**

### Domain concepts

- Todos os dados financeiros escopados por `userId` + `referenceMonth` (sempre `YYYY-MM-01`)
- Meses em URLs são `YYYY-MM`; usar helpers de `lib/utils/date.ts` — nunca construir strings de mês manualmente
- `<input type="month">` retorna `YYYY-MM` — schemas de formulário usam `yearMonthSchema`; converter para `YYYY-MM-01` antes de chamar a action (`referenceMonthSchema`)
- Budget por categoria: `category.defaultBudget` ou override via `monthlyBudgetOverrides` para o mês
- Parcela: 1 `installmentGroup` + N `transaction` rows; `calcBaseReferenceMonth`/`calcInstallmentDate` em `lib/utils/date.ts` definem qual mês é a 1ª parcela
- `paymentAccounts.type`: `credit | debit | pix`; quando `closingDay > 1`, dashboard exibe cycle select (`?cycleAccount=`)
- Contas gerenciadas em `/contas`; `/categorias` cobre apenas grupos e categorias
- Rota `/admin` protegida via `ADMIN_EMAIL` no `.env.local`

### Gotchas

- Datas: `new Date(dateStr + 'T12:00:00')` evita UTC shift ao converter para `referenceMonth`
- `dateSchema` faz overflow silencioso em datas inválidas (ex: 29/02 em não-bissexto) — não usar para validar precisão de calendário
- `ESLint react-hooks/immutability`: `let` reassignment em callbacks — usar `for` loop ou `reduce` sem mutação de variável externa
- Next.js 16: `params`/`searchParams` são `Promise<>` — `await`; paralelizar com `auth()` via `Promise.all`
- `@serwist/next`: usado em **configurator mode** (não o wrapper `withSerwistInit`, que injeta config webpack e não roda sob Turbopack — bundler padrão do `next build` no Next 16, gerava `public/sw.js` vazio em silêncio). `serwist.config.mjs` alimenta o CLI `@serwist/cli`, rodado como 2ª etapa do script `build` (`next build && serwist build serwist.config.mjs`). O registro no cliente é responsabilidade do app: `<SerwistProvider swUrl="/sw.js">` de `@serwist/next/react` **só** em `(app)/layout.tsx` — o CLI não injeta `register()` (o wrapper webpack injetava), e o escopo default `'/'` já cobre a origem inteira; fora do `(app)` seria Client Component na landing, que o §4.2 do `docs/seo-landing-backlog.md` esvaziou de propósito
- `app/sw.ts` — **nunca** usar `defaultCache` de `@serwist/next/worker`: ele grava HTML autenticado, payloads RSC e GETs em `/api/*` (inclusive `/api/export/completo`) em `CacheStorage`, que é legível por qualquer script da origem e sobrevive ao logout e à exclusão de conta. O `runtimeCaching` é estreito de propósito (só `/_next/static/**` e ícones de PWA); tudo com sessão é `NetworkOnly`. Fallback de navegação é `app/~offline`, que precisa continuar prerenderizável — rota dinâmica não emite HTML no build e some do manifest de precache. Gates: CI roda `npm run build` + `test -s public/sw.js`; `__tests__/unit/service-worker-registro.test.ts` amarra provider, `swUrl`↔`swDest`, existência do fallback e ausência de `defaultCache`
- Hook `PostToolUse` (`Edit|Write`, `.claude/hooks/post-edit-format.sh`) roda Prettier + ESLint no arquivo e acorda o Claude (exit 2) com o erro — import não usado entre dois `Edit` parciais dispara; usar `Write` para reescrever o arquivo inteiro quando há múltiplas mudanças. Ficou mudo de 2026-05 a 2026-10: sob `set -e`, `out=$(npx eslint ...)` falhando encerrava o script com exit 1 (não-bloqueante, sem saída). Ao mexer no script, testar com um arquivo que falha no lint e conferir `exit 2`
- Hook `PostToolUse:Write` também dispara ds-reviewer (não só `Edit`) — ao fazer múltiplas edições em arquivos de componente (ex: Sidebar, BottomNav), preferir um único `Write` completo a vários `Edit` para minimizar interrupções
- `error.tsx` em `app/(app)/` não captura erros lançados dentro do `layout.tsx` do mesmo nível (ex: falha no `auth()`, crash em `Sidebar`) — para isso é necessário `app/global-error.tsx`, que deve incluir `<html>` + `<body>` pois substitui o root layout
- `'use server'` inline em body de função dentro de arquivo `'use client'` é inválido — Next.js não suporta server actions definidas inline em Client Components; definir em arquivo separado com `'use server'` no topo e importar
- Security headers via `headers()` em `next.config.mjs`: o CSP precisa de `'unsafe-inline'` em `script-src`/`style-src` (a hidratação do Next e o script anti-flash do `next-themes` quebram sem); `'unsafe-eval'` só em dev (HMR); HSTS só em prod (não forçar HTTPS no localhost). `next/font` self-hospeda as fontes (`font-src 'self'`), `@vercel/speed-insights` é same-origin com fallback em `va.vercel-scripts.com`
- Metadata do root layout é herdada por **todas** as rotas — `alternates.canonical` ali faz cada página declarar `/` como canônica; canonical vive na página, nunca no root. Mesma lógica para providers de cliente: `ThemeProvider`/`Toaster`/`NextTopLoader` ficam em `(app)/layout.tsx` e `(auth)/layout.tsx`, não na raiz, senão a landing pública carrega JS que não usa
- `next/font`: `preload` é por documento, não por rota — fonte declarada no root vira `<link rel="preload">` até nas páginas que não a usam (custou 0,7 s de LCP na landing); usar `preload: false` na que não serve a rota crítica. Archivo e DM Sans chegam como fonte **variável** — enxugar o array `weight` nelas não reduz bytes, só evita peso sintetizado; a IBM Plex Mono é **estática** e emite um woff2 por peso declarado (~10 KB cada), então ali o array é peso de verdade
- Landing/SEO — números medidos, achados fechados e o que falta para lançar: `docs/seo-landing-backlog.md` (ler ao mexer em `app/(marketing)/`, metadata, ícones ou fontes)
- Skills instaladas em `.claude/skills/**/*.cjs` são varridas por `eslint .` e disparam `@typescript-eslint/no-require-imports`, quebrando o gate de `npm run lint` mesmo sem serem código do app — manter `.claude/` nos `ignores` do `eslint.config.mjs` (`.claude` é tooling, não source)

**UI:**
- `incomes` não tem `categoryId` — não exibir `CategoryPicker` para tipos não-despesa
- `app/(app)/layout.tsx` aplica padding global — páginas não adicionam wrapper próprio; usar `PageLayout` diretamente
- Header de página com ações: `<div className="flex items-start justify-between gap-4">` envolvendo `<PageHeader>` + ações
- Dialogs de mutação com formulário: fechar só no `try`, nunca no `catch` (o usuário perderia o que digitou); botão "Cancelar" chama `handleOpenChange(false)`, não `setOpen(false)` (handleOpenChange faz cleanup de estado). Exceção: confirmação de exclusão sem campo (`DeleteButton`, `RowActions`, diálogos de exclusão de pagamento) fecha no `catch` **depois** de `console.error` + `toast.error` — forma da #35
- Padrão responsivo: `<ResponsiveDialog>` (`components/ui/responsive-dialog.tsx`) — `<Dialog>` desktop (`lg+`) + `<Drawer>` mobile; não repetir `useMediaQuery` à mão (exceções com estrutura própria: `DeleteButton`, `RowActions`, `CobrancaDialog`, `RegistrationDialog`, diálogos de exclusão de pagamento)
- `TransactionEditButton`, `IncomeEditButton`, `FixedExpenseEditButton`, `InvestmentEntryDialog`, `WithdrawalDialog` aceitam `open`/`onOpenChange` para controle externo
- `CurrencyInput`: passar `preserveExplicitZero` quando zero é valor legítimo (orçamentos, aportes)
- Radix `<Select>`: não popula `FormData` — usar `onValueChange` + state; `value=""` dá runtime error — usar sentinel não-vazio
- Filtro booleano via URL: chip/button `'use client'` com `useRouter`; chip de toggle permanece visível quando `active = true` mesmo com `count === 0`
- Client Component com paginação acumulada (load-more) em página com server nav: passar `key={filterCombo}` concatenando todos os filtros — força React a desmontar/remontar e resetar `useState` de items/cursor quando filtros mudam; sem isso, `initialItems` do server são ignorados e a lista acumulada permanece
- Input de busca que dispara `router.push`: usar `localQ` state para responsividade imediata + `useRef<ReturnType<typeof setTimeout>>` + `clearTimeout` + delay 400ms antes de chamar `navigate({ q: value })` — evita roundtrips excessivos ao servidor
- `RowActions` requer `group` na div pai; aceita `additionalActions`, `triggerClassName`, `onEdit`, `onDelete` opcionais
- `formatCurrencyShort(value)` em `lib/utils/currency.ts` — "R$ 42,9k" / "R$ 1,2M"; usar em footers/chips
- `formatDayGroupLabel(date)` em `lib/utils/date.ts` — cabeçalho de grupo por dia ("Hoje, 9 de outubro", "Terça, 7 de outubro"); usado pelo dashboard e pelo Histórico — não reimplementar com `date-fns` direto
- Privacy mode: `SensitiveAmount` (mascara valor), `PrivacyToggle` (botão de olho) e `usePrivacyMode()` (hook com `mask(value)`) estão em `@/components/providers/PrivacyMode` — importar os três ao adicionar privacy a qualquer nova página
- Componente baseado em `Select` cujo valor precisa ser submetido via `FormData` (form uncontrolled): espelhar o state num `<input type="hidden" name value={value}>` — o `Select` do Radix não popula `FormData` sozinho; `MonthSelect` é a referência do padrão
- Resultado de ação que fica numa linha de texto (botão em `startTransition` + `message`/`error` ao lado): `<span role="status">` **sempre montado** com o texto dentro — `{msg && <span role="status">}` não anuncia de forma confiável — e `aria-disabled`+`aria-busy` com `if (isPending) return` no handler, nunca `disabled={isPending}` (o `disabled` joga o foco no `<body>`). Gate: `__tests__/unit/a11y-mensagem-de-status.test.ts` (#159); site novo entra na lista `CASOS`
- Editar lançamento (saída avulsa/fixa, entrada) reusa `TransactionForm` com props aditivas `mode="edit"` + `editContext`, não forms próprios; `TransactionEditButton`/`FixedExpenseEditButton`/`IncomeEditButton` só carregam dados e delegam ao form, que trava o tipo e roteia o submit para as actions de update existentes — nunca recriar `EditForm` cru

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
- Tema controlado via `next-themes` (`ThemeProvider` em `(app)/layout.tsx` e `(auth)/layout.tsx` — o root layout não tem providers); preferência salva em `localStorage`; toggle em `SettingsDialog` com opções Claro/Escuro/Sistema
- Vars de compatibilidade shadcn (`--background`, `--foreground`, `--card`, etc.) **não** precisam ser redeclaradas em `.dark {}` — são aliases que apontam para tokens Maré e herdam automaticamente
- Gráficos Recharts (`AnnualStackedChart`, `PatrimonyEvolutionChart`) usam cores hardcoded — não mudam com o tema (fase 2)

## Auditoria automática (Routines)

Quatro Routines agendadas (auditoria, implementação, review de PR, calibragem mensal) trabalham sobre a fila de issues `claude-audit`. Os prompts são versionados em `.claude/routines/` — a Routine só manda ler o arquivo — e mudam por PR. Nada ali é importado aqui de propósito: **sessão interativa não precisa ler esses arquivos**, salvo quando o trabalho for sobre as próprias Routines ou uma revisão de código seguindo o critério delas.

- `.claude/audit.md` — julgamento: o que é bug aqui, o que não reportar, candidatos já falsificados, rotação por dia, exigências de todo achado. Ler ao fazer `/code-review` ou auditoria manual
- `.claude/routines/fila.md` — estado da fila: labels (`claude-ready`, `claude-wip`, `claude-bloqueada`), higiene de issues presas, ciclo de review (webhook + comentário de marca no PR), cadência
- `.claude/routines/{auditoria,implementacao,review,calibragem}.md` — o processo de cada Routine

## Acompanhamento de PR (check-ins automáticos)

Sessão que abre PR se inscreve nos eventos (`subscribe_pr_activity`) e agenda check-ins de fallback (`send_later`). O fallback existe porque webhook perde alguns sinais — **"CI passou" e "novo push"** — não porque polling seja o mecanismo principal. Separar os dois estados de espera:

- **Esperando a máquina** (CI rodando, merge processando): check-in vale. Usar backoff `1h → 2h → 4h`, nunca 1h fixo.
- **Esperando humano** (CI verde, sem review pendente, `mergeable_state` limpo): **parar de checar.** O estado só muda quando o humano age, e tudo que pode chegar nesse meio-tempo — review, comentário, conflito de merge — vem por webhook, que já está inscrito. Avisar uma vez e encerrar os check-ins; não re-armar.
- **Nunca deixar dois check-ins armados para o mesmo PR.** Cancelar o anterior antes de armar o próximo — três simultâneos já aconteceram no PR #44.

Medido nos PRs #39, #43 e #44: 15 check-ins armados, ~4 renderam ação. Os 11 restantes caíram todos em "esperando humano" — no #43 foram 6 seguidos, de hora em hora, com CI verde desde a primeira.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
