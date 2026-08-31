import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Sidebar / BottomNav — item de navegação atual exposto a leitor de tela (#118) ─
//
// Não há infra de render de componente no projeto (sem jsdom/testing-library).
// O gate possível é sobre o texto-fonte: garantir que `aria-current` esteja
// amarrado à expressão de estado, e que seja `'page'` — não `true` nem um
// literal fixo. `aria-current="page"` fixo marcaria os 11+ links como a
// página atual (pior que o bug original); `aria-current={active}` renderiza
// `aria-current="false"` no item inativo, que ARIA trata como estado
// presente (não ausência) — React só omite `aria-*` para `undefined`/`null`.
// Ambas as correções erradas passariam num `toMatch(/aria-current/)` genérico.
// As asserções ancoram na linha inteira (`^\s*...$` com flag `m`), não em
// qualquer ocorrência do arquivo — senão o atributo comentado deixaria o
// teste verde com os 22 links de volta a se anunciar idênticos, mesmo modo
// de falha que `a11y-estado-selecao.test.ts` (#107) documenta para
// `aria-pressed`.

const sidebar = readFileSync(join(process.cwd(), 'components/layout/Sidebar.tsx'), 'utf-8')
const bottomNav = readFileSync(join(process.cwd(), 'components/layout/BottomNav.tsx'), 'utf-8')

describe('Sidebar — aria-current amarrado ao estado (#118, site 1)', () => {
  it('expõe aria-current="page" no item ativo do NavItem, e undefined nos demais', () => {
    expect(sidebar).toMatch(/^\s*aria-current=\{active \? 'page' : undefined\}$/m)
  })
})

describe('BottomNav — aria-current amarrado ao estado (#118, sites 2 e 3)', () => {
  it('expõe aria-current="page" no NavItem da barra inferior', () => {
    expect(bottomNav).toMatch(/^\s*aria-current=\{active \? 'page' : undefined\}$/m)
  })

  it('expõe aria-current="page" nos links inline do dialog "Menu"', () => {
    expect(bottomNav).toMatch(/^\s*aria-current=\{isActive\(href\) \? 'page' : undefined\}$/m)
  })
})
