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
//
// As asserções têm de mirar especificamente a className do gatilho, não o
// arquivo inteiro — senão uma variante de foco movida para outro elemento
// (ex: `DropdownMenu.Content`) deixa o teste verde com o bug intacto.

const source = readFileSync(join(process.cwd(), 'components/ui/row-actions.tsx'), 'utf-8')

// className do gatilho: o literal que carrega as classes de tamanho do kebab.
const triggerClassName = source.match(/'h-7 w-7 flex-shrink-0[^']*'/)?.[0]

describe('RowActions trigger — foco de teclado (#54)', () => {
  it('encontra a className do gatilho', () => {
    expect(triggerClassName).toBeDefined()
  })

  it('esconde o gatilho em lg e o reaparece no hover (comportamento preservado)', () => {
    expect(triggerClassName).toMatch(/lg:opacity-0/)
    expect(triggerClassName).toMatch(/lg:group-hover:opacity-100/)
  })

  it('reaparece o gatilho no foco de teclado em lg — só a correção certa passa', () => {
    expect(triggerClassName).toMatch(
      /lg:group-focus-within:opacity-100|lg:focus-visible:opacity-100/
    )
  })
})
