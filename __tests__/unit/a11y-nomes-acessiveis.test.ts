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
  const pattern = new RegExp(
    `<Button\\b(?:(?!<Button\\b)[\\s\\S])*?<${iconTag}\\b[\\s\\S]*?<\\/Button>`
  )
  return source.match(pattern)?.[0]
}

describe('DeleteButton — gatilho de exclusão com nome acessível (#126)', () => {
  const source = readFileSync(join(process.cwd(), 'components/ui/delete-button.tsx'), 'utf-8')
  const trigger = findClosestButtonWithIcon(source, 'Trash2')

  it('encontra o bloco do botão gatilho (o mais próximo do ícone Trash2)', () => {
    expect(trigger).toBeDefined()
  })

  it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
    expect(trigger).toMatch(/^\s*aria-label="[^"]+"\s*$/m)
  })
})
