import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── RowActions — trigger de foco (#54) ────────────────────────────────────
//
// Não há infra de render de componente no projeto (sem jsdom/testing-library),
// e jsdom não resolveria a variante de qualquer forma — media queries e
// pseudo-classes do Tailwind não são avaliadas em DOM simulado. A asserção
// possível é sobre a string de classe: o gatilho precisa declarar uma
// variante de foco no mesmo breakpoint em que declara `lg:opacity-0`, ao
// lado da variante de hover já existente.

const source = readFileSync(join(process.cwd(), 'components/ui/row-actions.tsx'), 'utf-8')

describe('RowActions trigger — foco de teclado (#54)', () => {
  it('declara opacidade condicional em lg (regressão: sem isso o teste abaixo não faz sentido)', () => {
    expect(source).toMatch(/lg:opacity-0/)
  })

  it('mantém a variante de hover existente', () => {
    expect(source).toMatch(/lg:group-hover:opacity-100/)
  })

  it('declara uma variante de foco que reaparece o gatilho em lg — só a correção certa passa', () => {
    expect(source).toMatch(/lg:group-focus-within:opacity-100|lg:focus-visible:opacity-100/)
  })
})
