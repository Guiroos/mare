import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, collectFiles } from './helpers/source-files'

// Gate por string sobre o código-fonte (#143). O `catch` de arquivar tipo de
// investimento afirmava "tipo com saldo" para qualquer falha — sessão
// expirada, ownership, rede. A causa de negócio real (saldo > 0, alcançável
// com render obsoleto) agora volta como `ActionResult` de
// `archiveInvestmentType`; o `catch` fica só com o excepcional, registrado
// via `console.error` e com mensagem genérica.
// Precedente: __tests__/unit/row-actions.test.ts (readFileSync + asserção
// sobre conteúdo do arquivo) e __tests__/unit/no-err-message.test.ts (varre
// app/ e components/ procurando um padrão proibido).
//
// Âncora no sink (`toast.error(...)`), não na estrutura do `catch`, pelo
// mesmo motivo já registrado em no-err-message.test.ts:32-40: um regex que
// exige `catch\s*\{` (sem binding) fica cego para `catch (err) {
// console.error(...); toast.error('Não é possível ...') }` — diagnóstico
// presente, afirmação falsa ainda na tela.
//
// Escopo: só a frase "Não é possível ..." em literal (qualquer aspa). Não é
// um detector geral de causa afirmada — "Tipo em uso." passaria. Causa
// conhecida chega ao toast como `result.message` (ActionResult) ou pela prop
// `errorMessage=`/`deleteErrorMessage=` (forma ratificada pela #35), nunca
// como literal em `toast.error(`.

const SCAN_DIRS = ['app', 'components']

const TOAST_LITERAL_NAO_E_POSSIVEL = /toast\.error\(\s*['"`]Não é possível /

// `catch (<binding>) { console.error(..., <binding>)` — o mesmo identificador
// no binding e no log, qualquer que seja o nome.
const CATCH_LOGS_BINDING = /catch\s*\((\w+)\)\s*\{\s*console\.error\([^)]*,\s*\1\s*\)/g

const COMPONENTS = [
  'components/investimentos/InvestmentTypeCard.tsx',
  'components/investimentos/InvestmentTypeAccordion.tsx',
]

describe('toast de erro não afirma "Não é possível ..." como literal (#143)', () => {
  it('nenhum toast.error em app/ e components/ usa o literal "Não é possível ..."', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir), '.tsx'))

    const ofensores = files
      .filter((file) => TOAST_LITERAL_NAO_E_POSSIVEL.test(readFileSync(file, 'utf-8')))
      .map((file) => file.replace(ROOT + '/', ''))

    expect(ofensores).toEqual([])
  })
})

describe.each(COMPONENTS)('%s — arquivar/restaurar', (path) => {
  const src = readFileSync(join(ROOT, path), 'utf-8')

  it('consome o ActionResult de archiveInvestmentType', () => {
    expect(src).toMatch(
      /const\s+(\w+)\s*=\s*await\s+archiveInvestmentType\([^)]*\)\s*if\s*\(\s*!\1\.ok\s*\)/
    )
  })

  it('archive e restore registram a exceção real no catch', () => {
    expect(src.match(CATCH_LOGS_BINDING)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(src).toMatch(/console\.error\([^)]*archiveInvestmentType/)
    expect(src).toMatch(/console\.error\([^)]*restoreInvestmentType/)
  })
})
