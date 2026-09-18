import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Gate por texto-fonte. A defasagem que este arquivo impede é a que se acumulou no #136:
// `assertMekConfigured` entrou como API nova exportada de `lib/crypto/keys.ts` e a § API do
// `.claude/crypto.md` — que é o que as sessões leem como autoridade — não a listava. Nada no
// lint, no tsc ou na suíte acusava, porque doc defasada não é erro de compilação.
//
// Escopo deliberadamente estreito: só `lib/crypto/`. Medi a alternativa genérica (assertar
// que todo caminho citado em `.claude/**/*.md` existe) e ela não se sustenta — 1109 caminhos
// citados, 5 inexistentes, nenhum acionável: abreviações como `(app)/layout.tsx`, uma menção
// prescritiva (`app/global-error.tsx`, que a regra manda criar) e um registro histórico.
//
// O gate é sobre o **nome exportado**, não sobre a qualidade da descrição: ele não sabe se a
// linha da doc está certa, só que ela existe. É o teto do que dá para automatizar aqui, e
// ainda assim é o modo de falha que de fato aconteceu.
const CRYPTO_DIR = join(process.cwd(), 'lib/crypto')
const doc = readFileSync(join(process.cwd(), '.claude/crypto.md'), 'utf-8')

function exportsOf(file: string): string[] {
  const src = readFileSync(join(CRYPTO_DIR, file), 'utf-8')
  return [...src.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map((m) => m[1]!)
}

const modulos = readdirSync(CRYPTO_DIR).filter((f) => f.endsWith('.ts'))

describe('.claude/crypto.md documenta a API de lib/crypto', () => {
  it('encontra os módulos de crypto', () => {
    // Guarda contra o gate virar vácuo: um rename de diretório deixaria `modulos` vazio e
    // todos os it() abaixo passariam por não existirem.
    expect(modulos.length).toBeGreaterThan(0)
  })

  for (const file of modulos) {
    for (const nome of exportsOf(file)) {
      it(`lista \`${nome}\` (de ${file})`, () => {
        expect(doc).toContain(nome)
      })
    }
  }
})
