import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Registro e fallback do service worker ─────────────────────────────────
//
// O configurator mode do `@serwist/next` (issue #101) só bundla `app/sw.ts`
// em `public/sw.js`. Diferente do `withSerwistInit` (webpack), a CLI
// `serwist build` NÃO injeta entry de registro no cliente — chamar
// `navigator.serviceWorker.register()` virou responsabilidade do app.
//
// O gate do CI (`test -s public/sw.js`) prova que o artefato existe, e passa
// verde tanto com o registro presente quanto ausente. Estes testes cobrem os
// dois lados que ele não vê: que alguém de fato registra o SW, e que o
// fallback offline aponta para uma rota que o build consegue precachear.
//
// Escopo do que estas asserções pegam: provider removido, renomeado, movido
// para o grupo errado; `swUrl` divergindo do `swDest`; `fallbacks` apontando
// para rota inexistente ou que deixou de ser estática. O que elas NÃO pegam:
// registro falhando em runtime (escopo errado, CSP, 404 no swUrl). Para isso
// o caminho é Playwright assertando
// `navigator.serviceWorker.getRegistrations().then(r => r.length > 0)`;
// não há infra de browser no CI hoje, e está registrado como não coberto no PR.
//
// `process.cwd()` é a convenção dos testes que leem fonte
// (dependencies.test.ts, paginas-publicas.test.ts) — não trocar por
// `import.meta.dirname`, que é o padrão dos arquivos `.mts` de config.
const ROOT = process.cwd()

// Só o shell autenticado. `manifest.ts` promete `start_url: '/dashboard'`, e o
// escopo default do `SerwistProvider` é `'/'` — registrar aqui já dá ao SW
// controle sobre a origem inteira, inclusive a landing.
//
// `(marketing)` ficou de fora de propósito: o `SerwistProvider` é Client
// Component, e a landing é a única rota cujo LCP é ranqueado (§4.2 do
// `docs/seo-landing-backlog.md`, que documenta a remoção dos providers de lá).
// `(auth)` e `(share)` também ficam de fora — `/e/<token>` tem credencial no
// path e não deve precachear nada.
const LAYOUTS_COM_REGISTRO = ['app/(app)/layout.tsx']
const LAYOUTS_SEM_REGISTRO = [
  'app/(marketing)/layout.tsx',
  'app/(auth)/layout.tsx',
  'app/(share)/layout.tsx',
]

/**
 * As asserções de ausência (`not.toContain`) precisam olhar código, não prosa:
 * os arquivos aqui documentam em comentário exatamente o que não devem fazer
 * ("nunca usar `defaultCache`", "SerwistProvider não fica aqui"), e uma busca
 * de substring crua reprovaria a implementação certa pelo comentário que a
 * justifica. `//` só é tratado como comentário quando não vem depois de `:`,
 * para não decepar `https://`.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const swSrc = readFileSync(join(ROOT, 'app/sw.ts'), 'utf-8')
const configSrc = readFileSync(join(ROOT, 'serwist.config.mjs'), 'utf-8')

/** `public/` é a raiz servida: `public/sw.js` chega ao browser como `/sw.js`. */
function urlServida(): string {
  const swDest = configSrc.match(/swDest:\s*'([^']+)'/)?.[1]
  expect(swDest, 'serwist.config.mjs não declara swDest').toBeDefined()
  return `/${swDest!.replace(/^public\//, '')}`
}

describe('registro do service worker', () => {
  it.each(LAYOUTS_COM_REGISTRO)('%s registra o service worker', (layout) => {
    const src = readFileSync(join(ROOT, layout), 'utf-8')

    expect(src, `${layout} não importa SerwistProvider`).toContain("from '@serwist/next/react'")
    // Ancorado no `swUrl`, não só no nome do componente: importar sem renderizar,
    // ou renderizar sem apontar para o artefato que o build gera, não registra
    // nada — e é o erro mais provável de quem mexer aqui depois.
    expect(src, `${layout} não renderiza <SerwistProvider swUrl="/sw.js">`).toMatch(
      /<SerwistProvider[^>]*swUrl="\/sw\.js"/
    )
  })

  it.each(LAYOUTS_SEM_REGISTRO)('%s não registra o service worker', (layout) => {
    const src = readFileSync(join(ROOT, layout), 'utf-8')

    // O caso que só a decisão certa rejeita: o PR original registrava também na
    // landing, e nada acusava o Client Component reintroduzido ali. Um teste que
    // apenas checasse a presença no `(app)` passaria verde nos dois estados.
    expect(semComentarios(src), `${layout} não deveria montar SerwistProvider`).not.toContain(
      'SerwistProvider'
    )
  })

  it('o swUrl registrado é o swDest que o build gera', () => {
    // Se `serwist.config.mjs` mudar o destino sem que o layout acompanhe, o
    // browser pede uma URL que ninguém escreve e o registro falha com 404 — sem
    // que `test -s public/sw.js` note, porque o artefato existe, só que noutro
    // caminho. Esta asserção amarra os dois lados.
    for (const layout of LAYOUTS_COM_REGISTRO) {
      const src = readFileSync(join(ROOT, layout), 'utf-8')
      expect(src, `${layout} registra URL diferente do swDest (${urlServida()})`).toContain(
        `swUrl="${urlServida()}"`
      )
    }
  })
})

describe('fallback offline', () => {
  it('a rota de fallback declarada no sw.ts existe', () => {
    const url = swSrc.match(/fallbacks:[\s\S]*?url:\s*'([^']+)'/)?.[1]

    expect(url, 'app/sw.ts não declara fallbacks.entries[].url').toBeDefined()

    // `app/~offline` → `/~offline`. Ler o arquivo é a asserção: `readFileSync`
    // lança se a rota não existir, que é o caso de alguém renomear a pasta e
    // deixar o `sw.ts` apontando para o nome antigo — o build não acusa, o
    // manifest de precache simplesmente não tem a entrada e o fallback vira
    // um erro silencioso na hora em que mais importa (offline).
    expect(() => readFileSync(join(ROOT, `app/${url!.slice(1)}/page.tsx`), 'utf-8')).not.toThrow()
  })

  it('a rota de fallback é estática o bastante para ser precacheada', () => {
    const src = semComentarios(readFileSync(join(ROOT, 'app/~offline/page.tsx'), 'utf-8'))

    // `precachePrerendered` (default do @serwist/next/config) monta o manifest a
    // partir de `.next/server/app/**/*.html`. Rota que opte por render dinâmico
    // não emite HTML no build, some do manifest, e o `fallbacks` passa a apontar
    // para uma URL que o SW não tem — com CI verde, porque `public/sw.js`
    // continua existindo.
    for (const dinamica of ['force-dynamic', 'auth(', 'headers(', 'cookies(', 'searchParams']) {
      expect(src, `app/~offline usa \`${dinamica}\` e deixa de ser prerenderizada`).not.toContain(
        dinamica
      )
    }
  })

  it('o sw.ts não usa o defaultCache do @serwist/next', () => {
    // `defaultCache` cacheia HTML autenticado, payloads RSC e GETs em `/api/*`
    // — inclusive `/api/export/completo` — em `CacheStorage`, que sobrevive ao
    // logout e à exclusão de conta. O raciocínio completo está no comentário de
    // bloco do `app/sw.ts`; aqui fica o gate, porque trocar o runtimeCaching
    // estreito pelo default é um diff de duas linhas que nada mais acusaria.
    expect(
      semComentarios(swSrc),
      'app/sw.ts importa defaultCache — ver o comentário no topo do arquivo'
    ).not.toContain('defaultCache')
  })
})
