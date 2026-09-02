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
// deixaria o teste verde com o gatilho de exclusão ainda sem nome.

describe('DeleteButton — gatilho de exclusão com nome acessível (#126)', () => {
  const source = readFileSync(join(process.cwd(), 'components/ui/delete-button.tsx'), 'utf-8')

  // Bloco do <Button> que é o gatilho (contém o onClick={() => setOpen(true)}
  // e o ícone Trash2) — não o botão "Excluir" do Dialog/Drawer, nem "Cancelar".
  const trigger = source.match(
    /<Button\b[^]*?onClick=\{\(\) => setOpen\(true\)\}[^]*?<Trash2[^]*?<\/Button>/
  )?.[0]

  it('encontra o bloco do gatilho', () => {
    expect(trigger).toBeDefined()
  })

  it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
    expect(trigger).toMatch(/^\s*aria-label="[^"]+"\s*$/m)
  })
})
