import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Chip / Segment — estado de seleção exposto a leitor de tela (#107) ────
//
// Não há infra de render de componente no projeto (sem jsdom/testing-library).
// O gate possível é sobre o texto-fonte: garantir que `aria-pressed` esteja
// amarrado à expressão de estado (`active` / `isActive`), não a um literal
// fixo — `aria-pressed="true"` fixo passaria num `toMatch(/aria-pressed/)`
// genérico e anunciaria todos os chips/segmentos como selecionados, um
// resultado pior que o bug original.

const chip = readFileSync(join(process.cwd(), 'components/ui/chip.tsx'), 'utf-8')
const segment = readFileSync(join(process.cwd(), 'components/ui/segment.tsx'), 'utf-8')

describe('Chip — aria-pressed amarrado ao estado (#107)', () => {
  it('expõe aria-pressed ligado à expressão `active`, não a um literal fixo', () => {
    expect(chip).toMatch(/aria-pressed=\{active\}/)
  })
})

describe('Segment — aria-pressed amarrado ao estado (#107)', () => {
  it('expõe aria-pressed ligado à expressão `isActive`, não a um literal fixo', () => {
    expect(segment).toMatch(/aria-pressed=\{isActive\}/)
  })
})
