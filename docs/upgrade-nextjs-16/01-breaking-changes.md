# Breaking Changes — Inventário e Impacto

Mapeamento de cada breaking change do Next.js 14 → 16 contra o codebase atual.

---

## 1. React 18 → 19 (obrigatório)

**Severidade:** alta — upgrade obrigatório, sem compat layer.

Next.js 15 e 16 exigem React 19 como versão mínima. A branch do Dependabot atualizou apenas o `next`, deixando React em 18.3.1 — conflito de peer deps não resolvido.

### O que muda para o app

| Item | Status |
| ---- | ------ |
| `useFormState` deprecated → `useActionState` | Não usamos `useFormState`. Sem impacto. |
| `useFormStatus` com propriedades novas | Não usamos. Sem impacto. |
| `@types/react` e `@types/react-dom` | Precisam subir junto com React 19. |
| React Compiler (opt-in) | Disponível mas não obrigatório. Não será ativado nesta fase. |
| View Transitions API | Opt-in via React. Não será ativada nesta fase. |

### Dependências afetadas

```
react              18.3.1  →  19.x (latest)
react-dom          18.3.1  →  19.x (latest)
@types/react       18.3.28 →  19.x (latest)
@types/react-dom   18.3.7  →  19.x (latest)
```

---

## 2. Async Request APIs (breaking no v16)

**Severidade:** alta — acesso síncrono removido completamente no v16 (no v15 era warning, no v16 é erro).

`params`, `searchParams`, `cookies`, `headers` e `draftMode` passam a ser Promises. Qualquer acesso síncrono lança exceção em runtime.

### Arquivos afetados no app

#### `app/(app)/dashboard/page.tsx`

```ts
// ANTES (quebra no v16)
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; cycleAccount?: string }
}) {
  const month = searchParams.month ?? currentYearMonth()
  const activeAccount = creditAccounts.find((a) => a.id === searchParams.cycleAccount) ?? null

// DEPOIS
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cycleAccount?: string }>
}) {
  const { month: rawMonth, cycleAccount } = await searchParams
  const month = rawMonth ?? currentYearMonth()
  const activeAccount = creditAccounts.find((a) => a.id === cycleAccount) ?? null
```

#### `app/(app)/panorama/page.tsx`

```ts
// ANTES
export default async function PanoramaPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const parsedYear = parseInt(searchParams.year ?? '', 10)

// DEPOIS
export default async function PanoramaPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year } = await searchParams
  const parsedYear = parseInt(year ?? '', 10)
```

#### `app/(app)/configuracao-mes/page.tsx`

```ts
// ANTES
export default async function ConfiguracaoMesPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const month = searchParams.month ?? currentYearMonth()

// DEPOIS
export default async function ConfiguracaoMesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? currentYearMonth()
```

#### `app/(app)/devedores/[id]/page.tsx`

```ts
// ANTES
export default async function DevedorDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [data, txForLink, openCharges] = await Promise.all([
    getPersonDebtDetails(session.user.id, params.id),
    ...
  ])

// DEPOIS
export default async function DevedorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, txForLink, openCharges] = await Promise.all([
    getPersonDebtDetails(session.user.id, id),
    ...
  ])
```

### APIs não afetadas

`cookies`, `headers`, `draftMode` — não são usados diretamente em nenhuma page ou layout do app.

---

## 3. Turbopack como padrão (next dev e next build)

**Severidade:** alta para `next build` — `@ducanh2912/next-pwa` injeta configuração webpack, causando falha de build.

No Next.js 16, `next build` usa Turbopack por padrão. Se detecta configuração webpack customizada, o build aborta com erro intencional para evitar misconfiguration silenciosa.

### Impacto

- `npm run dev` — falha silenciosa ou warning, dependendo da versão do plugin
- `npm run build` — falha com erro explícito de conflito webpack/Turbopack
- `vercel.json` buildCommand (`npm run db:migrate && npm run build`) — idem, falha no deploy

### Solução adotada

Migrar de `@ducanh2912/next-pwa` para `@serwist/next` com suporte nativo a Turbopack. Ver seção 4.

**Solução temporária caso a migração seja adiada:** adicionar `--webpack` ao script de build para forçar Webpack:

```json
"build": "next build --webpack"
```

Não recomendado como solução final — perde o ganho de velocidade do Turbopack.

---

## 4. `@ducanh2912/next-pwa` — abandonado para Next.js 16

**Severidade:** bloqueante para Turbopack (ver seção 3).

- Última versão: 10.2.9 (setembro 2024) — 8 meses sem atualização
- Issue de suporte a Turbopack fechada como "não planejada"
- O próprio mantenedor recomenda migrar para `@serwist/next`

### Alternativa: `@serwist/next`

- Versão atual: 9.5.11 (maio 2026) — ativamente mantido
- Suporte nativo a Turbopack via `@serwist/turbopack`
- Requer `app/sw.ts` (service worker declarativo) e ajuste no `next.config.mjs`

#### Mudança de arquitetura do PWA

| Aspecto | `@ducanh2912/next-pwa` | `@serwist/next` |
| ------- | ---------------------- | --------------- |
| Config | `withPWA({ ... })(nextConfig)` | `withSerwistInit({ swSrc, swDest })(nextConfig)` |
| Service worker | Gerado automaticamente | Requer `app/sw.ts` declarativo |
| Manifest | `app/manifest.ts` do Next.js | Mesmo — sem mudança |
| Turbopack | Não suporta | Suporte nativo via `@serwist/turbopack` |
| Estratégias de cache | Config no `withPWA` | Definidas no `sw.ts` via API Serwist |

#### Setup do `app` atual com PWA

O app usa o mínimo do PWA — apenas `withPWA` no config e `app/manifest.ts`. Não há `sw.ts` customizado nem estratégias de cache configuradas. A migração é simples.

---

## 5. `experimental.serverActions` obsoleto

**Severidade:** baixa — warning no console, sem impacto funcional.

Server Actions foram estabilizados no Next.js 15. A key `experimental.serverActions` em `next.config.mjs` pode gerar warning de configuração desconhecida no v16.

```js
// ANTES — next.config.mjs
const nextConfig = {
  experimental: {
    serverActions: {        // ← remover
      allowedOrigins: ['localhost:3000'],
    },
  },
}

// DEPOIS
const nextConfig = {
  serverActions: {
    allowedOrigins: ['localhost:3000'],
  },
}
```

---

## 6. `next lint` removido

**Severidade:** nenhuma para este app.

O comando `next lint` foi removido no v16. O app já usa `eslint . --max-warnings 0` diretamente no script de lint, e o hook do Husky também não chama `next lint`. Nenhuma mudança necessária.

---

## 7. Mudanças de comportamento (sem alteração de código)

Estas mudanças acontecem automaticamente ao atualizar — sem ação necessária, mas importante conhecer.

| Mudança | Impacto |
| ------- | ------- |
| `fetch` não cacheado por padrão | O app não usa `fetch` manual em Server Components — usa Drizzle diretamente. Sem impacto. |
| Client cache: páginas não reutilizadas entre navegações | Navegações entre meses/páginas sempre buscam RSC fresh. App já tem `loading.tsx` em todas as páginas. Impacto visual mínimo. |
| `next/image`: `minimumCacheTTL` de 60s → 4h | O app usa `next/image` apenas para ícones gerados via `app/icon.tsx` e `app/apple-icon.tsx`, não para imagens externas. Sem impacto. |
| Layout deduplication no prefetch | Sidebar e BottomNav (compartilhados) são baixados uma vez. Melhora performance de navegação. |
| Scroll behavior override removido | Se `scroll-behavior: smooth` estiver no CSS global, o comportamento de scroll muda. Verificar `app/globals.css`. |

---

## 8. Mudanças que não se aplicam ao app

| Mudança | Por quê não afeta |
| ------- | ----------------- |
| `middleware` renomeado para `proxy` | Sem arquivo `middleware.ts` no projeto |
| Parallel routes exigem `default.js` | Sem rotas paralelas (`@slot`) no projeto |
| `revalidateTag` exige segundo argumento | App usa `revalidatePath`, não `revalidateTag` |
| AMP removido | Nunca usado |
| `serverRuntimeConfig` / `publicRuntimeConfig` removidos | Nunca usados |
| `@next/font` removido | Já usando `next/font` |
| `next/legacy/image` deprecated | Usando `next/image` direto |
| `images.domains` deprecated | Config não usa `images.domains` |
| Sitemaps e opengraph-image com params async | App não tem `sitemap.ts` nem `opengraph-image` com `generateImageMetadata` |

---

## Resumo de Esforço

| Tarefa | Arquivos | Complexidade |
| ------ | -------- | ------------ |
| Bump React 18 → 19 + @types | `package.json` | baixa |
| Migrar params/searchParams async | 4 pages | baixa — mecânico |
| Migrar PWA para @serwist/next | `next.config.mjs` + novo `app/sw.ts` | média |
| Remover `experimental.serverActions` | `next.config.mjs` | trivial |
| Verificar scroll behavior | `app/globals.css` | trivial |
| Validar build e runtime | — | média (testes manuais) |
