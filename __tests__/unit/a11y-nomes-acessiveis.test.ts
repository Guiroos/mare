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

describe('InvestmentEntryDialog — lápis de "Editar registro" (#128, site 2)', () => {
  const source = readFileSync(
    join(process.cwd(), 'components/investimentos/InvestmentEntryDialog.tsx'),
    'utf-8'
  )

  // Ramo `existing` do ternário de três braços (existing / isGlobal / default)
  const existingBranch = source.match(/existing \? \(([\s\S]*?)\) : isGlobal \? \(/)?.[1]

  it('encontra o ramo `existing` do trigger', () => {
    expect(existingBranch).toBeDefined()
  })

  it('rotula o botão do lápis de editar, não o ícone', () => {
    expect(existingBranch).toMatch(/^\s*aria-label="Editar registro"$/m)
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

  it('rotula o botão do lápis de editar, não o ícone', () => {
    expect(source).toMatch(/^\s*aria-label="Editar orçamento"$/m)
  })
})

describe('GoalDialog — lápis de "Editar meta" (#128, site 7)', () => {
  const source = readFileSync(join(process.cwd(), 'components/metas/GoalDialog.tsx'), 'utf-8')

  // Ramo `else` do ternário `mode === 'create' ? (...) : (...)` — captura até
  // o primeiro `</Button>` após o separador, não até o primeiro `)}`: o botão
  // tem `onClick={() => setOpen(true)}`, que termina em `)}` e cortaria a
  // captura antes do `aria-label` se o limite fosse esse.
  const editBranch = source.match(/\) : \(([\s\S]*?<\/Button>)/)?.[1]

  it('encontra o ramo de edição do trigger', () => {
    expect(editBranch).toBeDefined()
  })

  it('rotula o botão do lápis de editar, não o ícone', () => {
    expect(editBranch).toMatch(/^\s*aria-label="Editar meta"$/m)
  })

  it('não rotula o ramo `create` (Nova meta) com o mesmo texto', () => {
    const createBranch = source.match(/mode === 'create' \? \(([\s\S]*?)\) : \(/)?.[1]
    expect(createBranch).not.toMatch(/aria-label/)
  })
})
