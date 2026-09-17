import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Botões só de ícone sem nome acessível (#106) ──────────────────────────
//
// `lucide-react@1.8.0` (package.json:45) marca o <svg> do ícone como
// `aria-hidden="true"` quando ele não recebe filho nem prop de a11y — então
// um <Button size="icon"> cujo único filho é um ícone chega ao leitor de tela
// como `role=button name=""`. Não há infra de render de componente no
// projeto (sem jsdom/testing-library); o gate possível é sobre o
// texto-fonte, mesmo padrão de row-actions.test.ts (#54) e
// a11y-estado-selecao.test.ts (#107).
//
// Cada asserção ancora no bloco JSX específico do botão-alvo, não em
// `toMatch(/aria-label/)` sobre o arquivo inteiro — os três componentes desta
// fatia (#128) têm mais de um <Button> no mesmo trecho (ternário de 2 ou 3
// braços), então uma asserção genérica passaria com qualquer um deles
// rotulado, deixando o lápis de editar intacto.

/**
 * Fatia do <Button> mais próximo do ícone, terminando ANTES da tag do ícone:
 * o que estiver no <svg> não conta como nome do controle — uma correção
 * errada que ponha `aria-label` no ícone em vez do `<Button>` não deve
 * passar. A barreira `(?!<\/Button>)` impede a fatia de atravessar um
 * fechamento e ancorar num botão anterior quando o `<Button>` mais próximo
 * do ícone não é, na verdade, o que o envolve.
 */
function gatilhoDoIcone(source: string, icone: string): string | undefined {
  return source.match(
    new RegExp(`<Button\\b(?:(?!<Button\\b)(?!<\\/Button>)[\\s\\S])*?<${icone}\\b`)
  )?.[0]
}

describe('InvestmentEntryDialog — lápis de "Editar registro" (#128, site 2)', () => {
  const source = readFileSync(
    join(process.cwd(), 'components/investimentos/InvestmentEntryDialog.tsx'),
    'utf-8'
  )

  const trigger = gatilhoDoIcone(source, 'Pencil')

  it('encontra o bloco do botão de editar (o mais próximo do ícone Pencil)', () => {
    expect(trigger).toBeDefined()
  })

  it('rotula o botão do lápis de editar, não o ícone', () => {
    expect(trigger).toMatch(/^\s*aria-label="Editar registro"$/m)
  })

  it('não rotula os outros dois ramos do ternário (isGlobal / default) com o mesmo texto', () => {
    const rest = source.slice(source.indexOf(') : isGlobal ? ('))
    expect(rest).not.toMatch(/aria-label="Editar registro"/)
  })
})

describe('BudgetOverrideDialog — lápis de "Editar orçamento" (#128, site 6)', () => {
  const source = readFileSync(
    join(process.cwd(), 'components/configuracao-mes/BudgetOverrideDialog.tsx'),
    'utf-8'
  )

  // O gatilho aqui não é ramo de ternário — é o único <Button> do bloco de
  // abertura, mas o arquivo tem outros dois <Button> fora dele (submit e
  // "Usar padrão"). `toMatch` sobre `source` cru passaria com o rótulo em
  // qualquer um dos três; a captura precisa mirar o <Button> mais próximo do
  // ícone Pencil, não a primeira ocorrência de `aria-label` no arquivo.
  const trigger = gatilhoDoIcone(source, 'Pencil')

  it('encontra o bloco do botão de editar (o mais próximo do ícone Pencil)', () => {
    expect(trigger).toBeDefined()
  })

  it('rotula o botão do lápis de editar, não o ícone', () => {
    expect(trigger).toMatch(/^\s*aria-label="Editar orçamento"$/m)
  })
})

describe('GoalDialog — lápis de "Editar meta" (#128, site 7)', () => {
  const source = readFileSync(join(process.cwd(), 'components/metas/GoalDialog.tsx'), 'utf-8')

  const editBranch = gatilhoDoIcone(source, 'Pencil')

  it('encontra o bloco do botão de editar (o mais próximo do ícone Pencil)', () => {
    expect(editBranch).toBeDefined()
  })

  it('rotula o botão do lápis de editar, não o ícone', () => {
    expect(editBranch).toMatch(/^\s*aria-label="Editar meta"$/m)
  })

  it('não rotula o ramo `create` (Nova meta) com o mesmo texto', () => {
    const createBranch = source.match(/mode === 'create' \? \(([\s\S]*?)\) : \(/)?.[1]
    expect(createBranch).not.toMatch(/aria-label="Editar meta"/)
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
