import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Registro do service worker ────────────────────────────────────────────
//
// O configurator mode do `@serwist/next` (issue #101) só bundla `app/sw.ts`
// em `public/sw.js`. Diferente do `withSerwistInit` (webpack), a CLI
// `serwist build` NÃO injeta entry de registro no cliente — chamar
// `navigator.serviceWorker.register()` virou responsabilidade do app.
//
// O gate do CI (`test -s public/sw.js`) prova que o artefato existe, e passa
// verde tanto com o registro presente quanto ausente. Este teste cobre o outro
// lado: que alguém de fato registra o SW. Sem ele, remover o `<SerwistProvider>`
// devolve o app ao estado da #101 (sem precache, sem offline) com CI verde e
// `/sw.js` sendo servido normalmente — falha silenciosa, exatamente o modo de
// falha que a issue original descreve.
//
// Escopo do que esta asserção pega: provider removido, renomeado, ou layout novo
// que deveria registrar e não registra. O que ela NÃO pega: provider presente mas
// registro falhando em runtime (escopo errado, CSP, 404 no swUrl). Para isso o
// caminho é Playwright assertando
// `navigator.serviceWorker.getRegistrations().then(r => r.length > 0)`;
// não há infra de browser no CI hoje, e está registrado como não coberto no PR.
//
// `process.cwd()` é a convenção dos testes que leem fonte
// (dependencies.test.ts, paginas-publicas.test.ts) — não trocar por
// `import.meta.dirname`, que é o padrão dos arquivos `.mts` de config.
const ROOT = process.cwd()

// Os dois grupos que possuem superfície de instalação: o shell autenticado
// (`manifest.ts` promete `start_url: '/dashboard'`) e a landing pública, de onde
// parte a instalação a partir da home. `(auth)` e `(share)` ficam de fora de
// propósito — `/e/<token>` tem credencial no path e não deve precachear nada.
const LAYOUTS_COM_REGISTRO = ['app/(app)/layout.tsx', 'app/(marketing)/layout.tsx']

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

  it('o swUrl registrado é o swDest que o build gera', () => {
    // Se `serwist.config.mjs` mudar o destino sem que os layouts acompanhem, o
    // browser pede uma URL que ninguém escreve e o registro falha com 404 — sem
    // que `test -s public/sw.js` note, porque o artefato existe, só que noutro
    // caminho. Esta asserção amarra os dois lados.
    const configSrc = readFileSync(join(ROOT, 'serwist.config.mjs'), 'utf-8')
    const swDest = configSrc.match(/swDest:\s*'([^']+)'/)?.[1]

    expect(swDest, 'serwist.config.mjs não declara swDest').toBeDefined()

    // `public/` é a raiz servida: `public/sw.js` chega ao browser como `/sw.js`.
    const urlServida = `/${swDest!.replace(/^public\//, '')}`

    for (const layout of LAYOUTS_COM_REGISTRO) {
      const src = readFileSync(join(ROOT, layout), 'utf-8')
      expect(src, `${layout} registra URL diferente do swDest (${urlServida})`).toContain(
        `swUrl="${urlServida}"`
      )
    }
  })
})
