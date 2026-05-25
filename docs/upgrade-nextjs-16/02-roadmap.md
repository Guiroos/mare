# Upgrade Next.js 16 — Roadmap

## Status Por Fase

| Fase | Objetivo                                | Status    |
| ---- | --------------------------------------- | --------- |
| 1    | Preparação e branch                     | concluída |
| 2    | Upgrade de dependências                 | concluída |
| 3    | Migração do PWA para @serwist/next      | concluída |
| 4    | Migração das Async Request APIs         | concluída |
| 5    | Ajustes de config e limpeza             | concluída |
| 6    | Validação e testes                      | concluída |

---

## Fase 1 — Preparação e Branch

**Objetivo:** partir da branch do Dependabot, que já tem o bump do `next` feito.

A branch `dependabot/npm_and_yarn/next-16.2.6` já contém `next@16.2.6` no `package.json` e `package-lock.json` atualizado — é exatamente o ponto de partida da Fase 2. Não faz sentido recriar esse trabalho.

Passos:

- [ ] Fazer checkout da branch do Dependabot: `git checkout dependabot/npm_and_yarn/next-16.2.6`
- [ ] Rodar `npm install` para garantir que o `node_modules` está em sincronia
- [ ] Confirmar que `next` está em `16.2.6` e React ainda em `18.3.1` (será atualizado na Fase 2)

Critério de aceite:

- Branch checada com `package.json` refletindo `next@16.2.6`.
- `npm install` sem erros críticos.

---

## Fase 2 — Upgrade de Dependências

**Objetivo:** atualizar Next.js, React e types para as versões alvo.

Passos:

- [ ] Atualizar `package.json` (usar `--save-exact`):
  ```bash
  npm install --save-exact next@16.2.6 react@19 react-dom@19
  npm install --save-exact --save-dev @types/react@19 @types/react-dom@19
  ```
- [ ] Verificar se `eslint-config-next` está na versão compatível (16.2.4 já instalado — ok)
- [ ] Rodar `npm install` e confirmar que `package-lock.json` não tem peer dep warnings críticos
- [ ] Tentar `npm run build` — esperar falha de Turbopack + webpack (next-pwa); confirmar mensagem de erro esperada
- [ ] Tentar `npm run dev` — verificar quais erros aparecem antes da migração do PWA

Critério de aceite:

- `package.json` com versões corretas e fixas (sem `^` ou `~`).
- Erros de build são apenas os esperados (Turbopack + webpack, async params).

---

## Fase 3 — Migração do PWA: @ducanh2912/next-pwa → @serwist/next

**Objetivo:** substituir o plugin de PWA por uma alternativa compatível com Turbopack.

### 3a — Instalar @serwist/next e serwist

- [ ] Desinstalar o pacote antigo:
  ```bash
  npm uninstall @ducanh2912/next-pwa
  ```
- [ ] Instalar os novos (usar `--save-exact` com a versão atual):
  ```bash
  npm install --save-exact @serwist/next serwist
  ```
  > Versão de referência em 24/05/2026: `@serwist/next@9.5.11`, `serwist@9.5.11`

### 3b — Criar o service worker

- [ ] Criar `app/sw.ts` com configuração básica de precache:
  ```ts
  import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
  import { Serwist } from 'serwist'

  declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
      __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    }
  }

  declare const self: ServiceWorkerGlobalScope

  const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [],
  })

  serwist.addEventListeners()
  ```

### 3c — Atualizar next.config.mjs

- [ ] Substituir o wrapper do `withPWA` pelo `withSerwistInit`:
  ```js
  import withSerwistInit from '@serwist/next'

  const withSerwist = withSerwistInit({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
    disable: process.env.NODE_ENV === 'development',
  })

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // ... config options
  }

  export default withSerwist(nextConfig)
  ```

### 3d — Verificar manifest e ícones

- [ ] Confirmar que `app/manifest.ts` continua funcionando (Serwist lê o manifest do Next.js automaticamente)
- [ ] Confirmar que `app/icon.tsx` e `app/apple-icon.tsx` não são afetados

### 3e — Resolver conflito webpack/Turbopack

`@serwist/next` injeta configuração webpack internamente. O Next.js 16 usa Turbopack por padrão e aborta o build quando detecta config webpack sem config Turbopack correspondente. A solução é adicionar `turbopack: {}` vazio ao `nextConfig` para sinalizar coexistência intencional:

```js
const nextConfig = {
  turbopack: {},
}
```

Esse campo não ativa nenhuma configuração extra — é apenas um sinal ao Next.js de que a coexistência é deliberada.

> **Alternativa futura**: existe `@serwist/turbopack`, pacote com integração 100% nativa ao Turbopack que elimina o `turbopack: {}`. A migração foi avaliada e descartada para esta fase — ver Questão Aberta #5.

- [ ] Adicionar `turbopack: {}` ao `nextConfig` em `next.config.mjs`
- [ ] Rodar `npm run build` — deve passar sem erro de conflito webpack/Turbopack
- [ ] Verificar que `public/sw.js` foi gerado

Critério de aceite:

- Build conclui sem erros.
- `public/sw.js` gerado corretamente.
- App instalável como PWA no navegador.
- `@ducanh2912/next-pwa` removido do `package.json`.

---

## Fase 4 — Migração das Async Request APIs

**Objetivo:** corrigir os 4 arquivos que acessam `params` e `searchParams` de forma síncrona.

> No v16 o acesso síncrono lança exceção em runtime. Cada arquivo é independente — podem ser feitos em paralelo.

### `app/(app)/dashboard/page.tsx`

- [ ] Alterar tipo de `searchParams` para `Promise<{ month?: string; cycleAccount?: string }>`
- [ ] Adicionar `await searchParams` antes do primeiro uso
- [ ] Desestruturar `{ month: rawMonth, cycleAccount }` do resultado
- [ ] Substituir todas as referências a `searchParams.month` e `searchParams.cycleAccount`

### `app/(app)/panorama/page.tsx`

- [ ] Alterar tipo de `searchParams` para `Promise<{ year?: string }>`
- [ ] Adicionar `await searchParams` antes do primeiro uso
- [ ] Substituir `searchParams.year` pelo valor desestruturado

### `app/(app)/configuracao-mes/page.tsx`

- [ ] Alterar tipo de `searchParams` para `Promise<{ month?: string }>`
- [ ] Adicionar `await searchParams` antes do primeiro uso
- [ ] Substituir `searchParams.month` pelo valor desestruturado

### `app/(app)/devedores/[id]/page.tsx`

- [ ] Alterar tipo de `params` para `Promise<{ id: string }>`
- [ ] Adicionar `const { id } = await params` antes do `Promise.all`
- [ ] Substituir `params.id` por `id` em todas as chamadas

### Validação

- [ ] Rodar `npx tsc --noEmit` — sem erros de tipo
- [ ] Rodar `npm run build` — build passa
- [ ] Testar navegação em dev: dashboard com `?month=`, panorama com `?year=`, devedores com ID dinâmico

Critério de aceite:

- `npx tsc --noEmit` sem erros.
- Todas as páginas carregam corretamente com e sem query params.
- Sem warnings de "sync dynamic API" no console de dev.

---

## Fase 5 — Ajustes de Config e Limpeza

**Objetivo:** remover configurações obsoletas e adaptar o `next.config.mjs` ao v16.

Passos:

- [ ] Remover `experimental.serverActions` de `next.config.mjs` e mover `allowedOrigins` para `serverActions` no nível raiz:
  ```js
  const nextConfig = {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  }
  ```
- [ ] Confirmar que `globals.css` não tem `scroll-behavior: smooth` no `html` (se tiver, adicionar `data-scroll-behavior="smooth"` ao `<html>` em `app/layout.tsx`)
  > Verificado: não há `scroll-behavior` em `globals.css`. Nenhuma ação necessária.
- [ ] Revisar se há algum uso de `process.argv` incluindo `'dev'` em `next.config.mjs` (no v16 retorna `false` durante `next dev`) — não há, nenhuma ação necessária
- [ ] Remover branch do Dependabot localmente se estiver presente: `git branch -D dependabot/npm_and_yarn/next-16.2.6`

Critério de aceite:

- `next.config.mjs` sem keys `experimental` desnecessárias.
- `npm run lint` sem warnings.

---

## Fase 6 — Validação e Testes

**Objetivo:** garantir que o app funciona corretamente após todas as migrações.

### Build e tipos

- [ ] `npm run lint` — zero warnings
- [ ] `npx prettier --check .` — sem diferenças de formatação
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npm run build` — build completo sem erros

### Smoke tests com Playwright (fluxo principal)

- [ ] Abrir `/dashboard` — carrega, saldo e lista corretos
- [ ] Navegar entre meses com `?month=` — `searchParams` async funciona
- [ ] Abrir `/panorama` com `?year=` — funciona
- [ ] Abrir `/configuracao-mes` com `?month=` — funciona
- [ ] Abrir `/devedores/<id>` — `params` async funciona, página carrega
- [ ] Registrar uma transação via drawer — Server Action funciona
- [ ] Marcar gasto fixo como pago — revalidação funciona
- [ ] PWA: verificar que o app é instalável (`manifest.json` presente, `sw.js` registrado)
- [ ] PWA: inspecionar Network no DevTools — service worker ativo

### Validação de performance (opcional mas recomendado)

- [ ] Comparar tempo de cold start do `next dev` antes e depois (esperado: melhora significativa com Turbopack)
- [ ] Comparar tempo de `npm run build` antes e depois

Critério de aceite:

- Suite completa de checks passa sem erros.
- Todos os fluxos principais funcionam.
- PWA instalável com service worker ativo.
- Nenhum regression visível nas páginas testadas.

---

## Rollback

Se qualquer fase travar e for necessário voltar:

```bash
git checkout main
```

A branch do Dependabot pode ser abandonada sem merge — o Dependabot recria automaticamente quando necessário.

---

## Questões Abertas

| # | Questão | Recomendação | Status |
| - | ------- | ------------ | ------ |
| 1 | Habilitar React Compiler? | Não nesta fase — opt-in, adiciona Babel ao pipeline e aumenta tempo de build. Reavaliar após estabilização. | pendente |
| 2 | Habilitar View Transitions? | Não nesta fase — requer design e implementação específica. Backlog. | pendente |
| 3 | Estratégias de cache no service worker (Serwist) | Setup mínimo com precache básico é suficiente para v1 da migração. Expandir se necessário. | decidido |
| 4 | `runtimeCaching` para rotas de API? | O app é data-heavy e não faz sentido cachear respostas de Server Components offline. Manter vazio por ora. | decidido |
| 5 | Migrar para `@serwist/turbopack` (nativo)? | Descartado para esta fase. O `@serwist/turbopack` elimina o `turbopack: {}` e remove webpack do pipeline, mas exige route handler `app/serwist/[path]/route.ts`, muda o SW de `/sw.js` para `/serwist/sw.js` (quebra PWAs instalados), e adiciona `esbuild` como dependência. Como o app usa apenas precache básico (`runtimeCaching: []`), o ganho é só arquitetural. Reavaliar quando offline real for necessário. | decidido |

---

## Inventário de Arquivos

### Criados

| Arquivo | Motivo |
| ------- | ------ |
| `app/sw.ts` | Service worker declarativo exigido pelo @serwist/next |

### Alterados

| Arquivo | Mudança |
| ------- | ------- |
| `package.json` | next 16.2.6, react 19, react-dom 19, @types/react 19, @types/react-dom 19; remove @ducanh2912/next-pwa; adiciona @serwist/next e serwist |
| `next.config.mjs` | Troca withPWA por withSerwistInit; move serverActions para fora do experimental |
| `app/(app)/dashboard/page.tsx` | searchParams → Promise, await |
| `app/(app)/panorama/page.tsx` | searchParams → Promise, await |
| `app/(app)/configuracao-mes/page.tsx` | searchParams → Promise, await |
| `app/(app)/devedores/[id]/page.tsx` | params → Promise, await |

### Removidos

| Arquivo/Pacote | Motivo |
| -------------- | ------ |
| `@ducanh2912/next-pwa` | Substituído por @serwist/next |
