import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Integridade das páginas públicas ──────────────────────────────────────
//
// Não há infra de render de componente no projeto (sem jsdom/testing-library),
// então a asserção é sobre o texto-fonte — mesmo padrão de row-actions.test.ts.
//
// O que este teste pega, e nenhuma outra checagem pega:
//   1. Página pública nova que ninguém acrescentou ao sitemap. Lighthouse dá
//      100 em SEO com o sitemap incompleto — ele não sabe o que falta.
//   2. Página sem `alternates.canonical` próprio. O root layout não declara
//      (§4.5 do backlog): quem esquecer não é sinalizado por gate nenhum, e a
//      página se anula no índice.
//   3. Link do rodapé apontando para rota que não existe — 404 na letra miúda.
//   4. Publicação com os valores pendentes ainda no texto.
//
// A entrada que só a correção certa rejeita é a #4: um teste que apenas
// contasse rotas passaria com `placeholder@email.com` no ar.

// `process.cwd()` é a convenção dos testes existentes que leem fonte
// (dependencies.test.ts:11, row-actions.test.ts:18) — não trocar por
// `import.meta.dirname`, que é o padrão dos arquivos `.mts` de config.
const ROOT = process.cwd()
const MARKETING = join(ROOT, 'app/(marketing)')

function publicRoutes(): string[] {
  return readdirSync(MARKETING, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/${entry.name}`)
}

const sitemapSrc = readFileSync(join(ROOT, 'app/sitemap.ts'), 'utf-8')
const footerSrc = readFileSync(join(ROOT, 'components/marketing/MarketingFooter.tsx'), 'utf-8')

describe('páginas públicas', () => {
  it('toda rota do grupo (marketing) está no sitemap', () => {
    for (const route of publicRoutes()) {
      // Ancorado em `${SITE_URL}<rota>`, a forma como o sitemap monta a URL, e
      // não na rota solta: esta última casa com qualquer menção em prosa —
      // o comentário de bloco do arquivo já citava as três rotas nominalmente,
      // e a asserção passava verde sobre um sitemap com uma entrada só.
      expect(sitemapSrc, `${route} não está em app/sitemap.ts`).toContain(`\${SITE_URL}${route}`)
    }
  })

  it('toda rota do grupo (marketing) declara canonical próprio', () => {
    for (const route of publicRoutes()) {
      const src = readFileSync(join(MARKETING, route.slice(1), 'page.tsx'), 'utf-8')
      expect(src, `${route} não declara alternates.canonical`).toContain(`canonical: '${route}'`)
    }
  })

  it('todo link interno do rodapé aponta para rota existente', () => {
    // Casa as duas formas que o rodapé pode escrever a rota: `href="/x"` em JSX
    // e `href: '/x'` num array de dados. A primeira versão só cobria o JSX e
    // era vácuo — o rodapé usa a segunda, e plantar `/rota-que-nao-existe`
    // passava verde.
    const hrefs = [...footerSrc.matchAll(/href(?:="|:\s*['"])(\/[^'"]*)['"]/g)].map((m) => m[1])
    // Sem isto, uma mudança de forma futura volta a esvaziar a lista em
    // silêncio e o `for` abaixo não itera sobre nada.
    expect(hrefs.length, 'nenhum link interno encontrado no rodapé').toBeGreaterThan(0)
    const known = ['/', ...publicRoutes()]
    for (const href of hrefs) {
      expect(known, `rodapé aponta para ${href}, que não existe`).toContain(href)
    }
  })

  it('as três páginas legais estão no ar', () => {
    expect(publicRoutes().sort()).toEqual(['/privacidade', '/seguranca', '/termos'])
  })

  it('nenhum valor pendente sobreviveu à publicação', () => {
    for (const route of publicRoutes()) {
      const src = readFileSync(join(MARKETING, route.slice(1), 'page.tsx'), 'utf-8')
      expect(src, `${route} ainda tem e-mail placeholder`).not.toContain('placeholder@email.com')
      expect(src, `${route} ainda tem nome placeholder`).not.toContain('[NOME COMPLETO]')
    }
  })
})
