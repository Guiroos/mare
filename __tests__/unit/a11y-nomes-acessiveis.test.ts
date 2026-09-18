import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Botões só de ícone sem nome acessível (#106) ──────────────────────────
//
// Não há infra de render de componente no projeto (sem jsdom/testing-library).
// O gate possível é sobre o texto-fonte, padrão já usado em row-actions.test.ts
// (#54) e a11y-estado-selecao.test.ts (#107).
//
// A asserção precisa ancorar no <Button> que envolve o ícone, não no arquivo
// inteiro — senão um aria-label em qualquer outro botão do mesmo arquivo
// deixaria o teste verde com o gatilho ainda sem nome.

function findClosestButtonWithIcon(source: string, iconTag: string): string | undefined {
  // Ancora no <Button> MAIS PRÓXIMO do ícone: a lookahead negativa impede o
  // match de atravessar outro "<Button" antes de alcançar o ícone-alvo — sem
  // isso um regex guloso/lazy simples poderia casar a partir de um <Button>
  // anterior no mesmo arquivo, desde que os marcadores (onClick, ícone,
  // </Button>) só existam depois dele.
  const pattern = new RegExp(`<Button\\b(?:(?!<Button\\b)[\\s\\S])*?<${iconTag}\\b`)
  return source.match(pattern)?.[0]
}

describe('DeleteButton — gatilho de exclusão com nome acessível (#126)', () => {
  const source = readFileSync(join(process.cwd(), 'components/ui/delete-button.tsx'), 'utf-8')
  const trigger = findClosestButtonWithIcon(source, 'Trash2')

  it('encontra o bloco do botão gatilho (o mais próximo do ícone Trash2)', () => {
    expect(trigger).toBeDefined()
  })

  it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
    // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
    // encontrado é atributo do próprio botão, não de um wrapper interno
    // (ex: um Tooltip envolvendo o Trash2).
    expect((trigger!.match(/</g) ?? []).length).toBe(2)
    // aria-label={title}, não literal fixo — a prop `title` já é o que os
    // call sites (inclusive os de /viagens) usam para diferenciar o rótulo
    // por tela; aceita tanto `{expressão}` quanto `"literal"`.
    expect(trigger).toMatch(/^\s*aria-label=(?:\{[^{}]+\}|"[^"]+")\s*$/m)
  })

  it('a prop title tem default — o rótulo não vira undefined nos call sites sem title', () => {
    // aria-label={title} só nomeia de verdade se `title` tiver um valor em
    // runtime. 6 dos 8 pontos de render não passam `title` (dependem
    // inteiramente do default); sem ele, aria-label={undefined} faz o React
    // omitir o atributo e o gatilho volta a ficar sem nome acessível — e as
    // duas asserções acima continuam verdes, porque `aria-label={title}` é
    // sintaticamente idêntico com ou sem default.
    expect(source).toMatch(/^\s*title = '[^']+',$/m)
  })
})

// ─── SplitSection — dois "X" idênticos sem nome acessível (#129) ──────────
//
// `lucide-react@1.8.0` (pinado em package.json) marca o <svg> do ícone como
// aria-hidden="true" quando não recebe filho nem prop de a11y — sem
// aria-label no <Button>, o role=button chega ao leitor de tela sem nome.
//
// SplitSection.tsx tem 5 <Button> no total (o "Dividir com alguém", os dois
// <X>, e mais dois no rodapé), e os dois sites em risco usam o mesmo ícone
// <X> — um `toMatch(/aria-label/)` genérico sobre o arquivo passaria com
// qualquer um deles rotulado, e um recorte que pegue só a primeira
// ocorrência deixaria o segundo site descoberto. O gate precisa: (1) achar
// os dois <Button> que envolvem um <X>, (2) exigir aria-label em ambos, e
// (3) exigir que os rótulos sejam distintos — o defeito original é a
// ambiguidade entre "fechar tudo" e "remover uma pessoa", não a ausência
// isolada de nome.

const splitSection = readFileSync(
  join(process.cwd(), 'components/forms/transaction/SplitSection.tsx'),
  'utf-8'
)

describe('SplitSection — os dois botões "X" têm nomes distintos (#129)', () => {
  it('tem exatamente dois <Button> envolvendo um <X>', () => {
    const gatilhos = [...splitSection.matchAll(/<Button\b(?:(?!<Button)[\s\S])*?<X\b/g)].map(
      (m) => m[0]
    )
    expect(gatilhos).toHaveLength(2)
  })

  it('cada gatilho tem aria-label, e os dois rótulos são distintos', () => {
    const gatilhos = [...splitSection.matchAll(/<Button\b(?:(?!<Button)[\s\S])*?<X\b/g)].map(
      (m) => m[0]
    )
    const rotulos = gatilhos.map((g) => g.match(/^\s*aria-label="([^"]+)"$/m)?.[1])

    // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
    // encontrado é atributo do próprio botão, não de um wrapper interno.
    expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
    expect(rotulos.every(Boolean)).toBe(true)
    expect(new Set(rotulos).size).toBe(rotulos.length)
  })
})
