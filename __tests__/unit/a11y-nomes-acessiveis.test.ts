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

function findButtonsWithIcon(source: string, iconTag: string): string[] {
  // Ancora no <Button> MAIS PRÓXIMO do ícone: a lookahead negativa impede o
  // match de atravessar outro "<Button" antes de alcançar o ícone-alvo — sem
  // isso um regex guloso/lazy simples poderia casar a partir de um <Button>
  // anterior no mesmo arquivo, desde que os marcadores (onClick, ícone,
  // </Button>) só existam depois dele.
  //
  // Devolve TODOS os recortes, não o primeiro: um `match` não-global mediria
  // só o primeiro gatilho e deixaria qualquer ícone seguinte descoberto em
  // silêncio, que é o modo de falha que o gate do SplitSection (abaixo) já
  // existia para impedir.
  //
  // Para no início da tag do ícone (não em "</Button>"): estender até o
  // fechamento incluiria os atributos do próprio ícone no recorte, e um
  // aria-label colocado ali por engano — a correção errada que estas issues
  // existem para barrar — passaria a asserção sempre que o prettier quebrasse
  // os atributos do ícone em linhas.
  const pattern = new RegExp(`<Button\\b(?:(?!<Button\\b)[\\s\\S])*?<${iconTag}\\b`, 'g')
  return [...source.matchAll(pattern)].map((m) => m[0])
}

describe('DeleteButton — gatilho de exclusão com nome acessível (#126)', () => {
  const source = readFileSync(join(process.cwd(), 'components/ui/delete-button.tsx'), 'utf-8')
  const gatilhos = findButtonsWithIcon(source, 'Trash2')

  it('tem exatamente um <Button> envolvendo um <Trash2>', () => {
    expect(gatilhos).toHaveLength(1)
  })

  it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
    // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
    // encontrado é atributo do próprio botão, não de um wrapper interno
    // (ex: um Tooltip envolvendo o Trash2).
    expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
    // Prende a expressão a `title`, não a "alguma expressão": os call sites
    // usam `title` para diferenciar o rótulo por tela, e qualquer outra prop
    // do componente (`errorMessage`, por exemplo) satisfaria um regex genérico
    // enquanto rende aria-label={undefined} em runtime — React omite o
    // atributo e o gatilho volta ao name="" medido na #126.
    //
    // Sem âncora de linha de propósito: exigir o atributo em linha própria
    // deixaria o gate vermelho sobre um gatilho correto que o prettier tenha
    // colapsado numa linha só (cabe em 100 colunas com menos props).
    expect(gatilhos.every((g) => /\baria-label=\{title\}/.test(g))).toBe(true)
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

describe('Lápis de editar — cadastro (#127)', () => {
  const cases = [
    {
      name: 'CategoryDialog — editar categoria',
      path: 'components/categorias/CategoryDialog.tsx',
    },
    {
      name: 'GroupDialog — editar grupo',
      path: 'components/categorias/GroupDialog.tsx',
    },
    {
      name: 'AccountDialog — editar conta',
      path: 'components/contas/AccountDialog.tsx',
    },
  ]

  for (const { name, path } of cases) {
    describe(name, () => {
      const source = readFileSync(join(process.cwd(), path), 'utf-8')
      const gatilhos = findButtonsWithIcon(source, 'Pencil')

      it('tem exatamente um <Button> envolvendo um <Pencil>', () => {
        expect(gatilhos).toHaveLength(1)
      })

      it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
        // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
        // encontrado é atributo do próprio botão, não de um wrapper interno
        // nem de um <Button> anterior que o recorte atravessou.
        expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
        expect(gatilhos.every((g) => /^\s*aria-label="[^"]+"$/m.test(g))).toBe(true)
      })
    })
  }
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
  const gatilhos = findButtonsWithIcon(splitSection, 'X')

  it('tem exatamente dois <Button> envolvendo um <X>', () => {
    expect(gatilhos).toHaveLength(2)
  })

  it('cada gatilho tem aria-label, e os dois rótulos são distintos', () => {
    const rotulos = gatilhos.map((g) => g.match(/^\s*aria-label="([^"]+)"$/m)?.[1])

    // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
    // encontrado é atributo do próprio botão, não de um wrapper interno.
    expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
    expect(rotulos.every(Boolean)).toBe(true)
    expect(new Set(rotulos).size).toBe(rotulos.length)
  })
})
