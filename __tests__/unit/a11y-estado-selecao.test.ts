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
//
// As asserções ancoram na linha inteira (`^\s*...$` com flag `m`), não em
// qualquer ocorrência do arquivo — senão o atributo comentado (`// aria-
// pressed={active}`) deixaria o teste verde com o botão de volta sem estado,
// mesmo modo de falha que row-actions.test.ts documenta para a className do
// gatilho.

const chip = readFileSync(join(process.cwd(), 'components/ui/chip.tsx'), 'utf-8')
const segment = readFileSync(join(process.cwd(), 'components/ui/segment.tsx'), 'utf-8')

describe('Chip — aria-pressed amarrado ao estado (#107)', () => {
  it('expõe aria-pressed ligado à expressão `active`, não a um literal fixo nem comentado', () => {
    expect(chip).toMatch(/^\s*aria-pressed=\{active\}$/m)
  })
})

describe('Segment — aria-pressed amarrado ao estado (#107)', () => {
  it('expõe aria-pressed ligado à expressão `isActive`, não a um literal fixo nem comentado', () => {
    expect(segment).toMatch(/^\s*aria-pressed=\{isActive\}$/m)
  })
})

// ─── Field / CurrencyInput — estado obrigatório exposto a leitor de tela (#166) ─
//
// `<Field required>` só desenhava um asterisco; o controle declarava
// `required=false` na árvore de acessibilidade. A asserção prende a expressão
// (`!!required`), não a presença do atributo: `aria-required={true}` literal
// passaria num `toMatch(/aria-required/)` e anunciaria todo `<Field>` como
// obrigatório. `CurrencyInput` tem interface fechada (sem `...props`), então a
// prop precisa estar declarada **e** repassada ao `<input>` visível.

const field = readFileSync(join(process.cwd(), 'components/ui/field.tsx'), 'utf-8')
const currencyInput = readFileSync(join(process.cwd(), 'components/ui/currency-input.tsx'), 'utf-8')

describe('Field — aria-required amarrado a `required` (#166)', () => {
  it('clona aria-required ligado a `!!required`, não a um literal fixo nem comentado', () => {
    expect(field).toMatch(/^\s*'aria-required': !!required,$/m)
  })
})

describe('CurrencyInput — repassa aria-required ao input visível (#166)', () => {
  it('declara a prop na interface', () => {
    expect(currencyInput).toMatch(/^\s*'aria-required'\?: boolean$/m)
  })
  it('repassa ao <input> visível', () => {
    expect(currencyInput).toMatch(/^\s*aria-required=\{ariaRequired\}$/m)
  })
})
