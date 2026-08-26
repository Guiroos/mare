/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

/* ─── Por que não `defaultCache` de `@serwist/next/worker` ──────────────────
 *
 * É a escolha óbvia e está errada para este app. O `defaultCache` grava em
 * `CacheStorage`, com `NetworkFirst`:
 *
 *   - todo HTML same-origin (cache `pages`) — inclui `/dashboard`, `/panorama`
 *     e `/historico` já renderizados, com os valores decriptados;
 *   - todo payload RSC same-origin (caches `pages-rsc`, `pages-rsc-prefetch`);
 *   - todo GET em `/api/*` (cache `apis`) — o que inclui
 *     `/api/export/completo`, que devolve a conta inteira em `.xlsx`.
 *
 * `CacheStorage` é legível por qualquer script da origem, sobrevive ao
 * logout e sobrevive à exclusão de conta (`lib/actions/delete-account.ts`
 * apaga o banco, não o disco do cliente). Num app cujo diferencial declarado
 * é cifrar campo a campo em repouso, isso põe em texto claro no dispositivo
 * exatamente o que a DEK protege no servidor.
 *
 * Então o `runtimeCaching` abaixo é deliberadamente estreito: cacheia apenas
 * artefato de build imutável e ícone de PWA. Nada que dependa de sessão passa
 * por cache — `NetworkOnly`, sempre.
 *
 * O que ainda assim ganhamos, e era o objetivo da issue #101:
 *   1. `/~offline` como fallback de navegação, em vez da tela de erro do
 *      browser;
 *   2. um `fetch` handler capaz de responder offline, que é o que o Chrome
 *      exige para disparar o prompt de instalação no Android — sem ele o
 *      `manifest.ts` (`display: 'standalone'`, `start_url: '/dashboard'`) e
 *      todo o aparato de ícones nunca chegam a ser oferecidos.
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    /* `/_next/static/**` tem hash de conteúdo na URL e é imutável por
       definição — inclui os woff2 que o `next/font` self-hospeda. */
    matcher: ({ url: { pathname }, sameOrigin }) =>
      sameOrigin && pathname.startsWith('/_next/static/'),
    handler: new CacheFirst({
      cacheName: 'next-static',
      plugins: [new ExpirationPlugin({ maxEntries: 96, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    /* Só as rotas de ícone do PWA, casadas por caminho e não por
       `request.destination === 'image'`: aquele predicado pegaria também
       `/_next/image?url=…`, que é por onde passa o avatar do Google do
       usuário logado (`users.image`) — dado pessoal, não asset de marca. */
    matcher: ({ url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      (pathname.startsWith('/icons/') || pathname === '/icon' || pathname === '/apple-icon'),
    handler: new StaleWhileRevalidate({
      cacheName: 'pwa-icons',
      plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    /* Navegação: nunca cacheada. O `PrecacheFallbackPlugin` que o `fallbacks`
       abaixo injeta entra pelo `handlerDidError` — ou seja, só quando a rede
       falha de verdade. Online, o comportamento é idêntico a não ter SW. */
    matcher: ({ request }) => request.mode === 'navigate',
    handler: new NetworkOnly(),
  },
  {
    /* Catch-all explícito: RSC, `/api/*`, exportações, `/e/<token>`. Estar
       escrito importa — sem esta entrada o comportamento seria o mesmo, mas
       ficaria implícito, e a próxima pessoa a mexer aqui não teria onde ler
       que a ausência de cache é intencional. */
    matcher: () => true,
    handler: new NetworkOnly(),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        /* O plugin é anexado a TODAS as entradas de `runtimeCaching`
           (`Serwist` faz isso no construtor), então o `matcher` é o que impede
           um JS ou um RSC que falhou de receber HTML de volta. */
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
