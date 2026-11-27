import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Resultado de ação anunciado por região viva (#159) ─────────────────────
//
// Sem infra de render (sem jsdom/testing-library): gate sobre o texto-fonte.
// A correção errada mais provável é `{message && <span role="status">…`, que
// monta a região junto com o texto e não anuncia de forma confiável
// (`components/ui/combobox.tsx` documenta o motivo) — por isso a asserção 1
// recusa `role="status"` atrás do booleano. As asserções 3 e 4 são o par:
// proibir só `disabled={isPending}` deixaria passar a remoção do estado
// ocupado; exigir só `aria-busy` deixaria passar os dois juntos, mantendo a
// perda de foco (o `disabled` tira o foco para o `<body>`).

const CASOS = [
  { file: 'components/configuracao-mes/CopyPrevMonthButton.tsx', estado: 'message' },
  { file: 'components/configuracao-mes/CopyFixedExpensesButton.tsx', estado: 'message' },
  { file: 'components/contas/CreditModeSection.tsx', estado: 'error' },
]

describe.each(CASOS)('$file — região viva e foco preservado (#159)', ({ file, estado }) => {
  const src = readFileSync(join(process.cwd(), file), 'utf-8')

  it('não monta a região viva atrás do booleano que ela anuncia', () => {
    // `\(?` cobre a forma que o Prettier produz ao quebrar a linha (`&& (` + <span>); `?` cobre o ternário
    expect(src).not.toMatch(new RegExp(`\\{${estado}\\s*(&&|\\?)\\s*\\(?\\s*<[^>]*role="status"`))
  })

  it('tem região role="status" sempre montada', () => {
    expect(src).toMatch(/<(span|p)\s+role="status"/)
  })

  it('não desabilita o botão por isPending (o foco cairia no body)', () => {
    expect(src).not.toMatch(/(?<![-\w])disabled=\{[^}]*isPending[^}]*\}/)
  })

  it('amarra aria-busy e aria-disabled a isPending e barra o clique no handler', () => {
    expect(src).toMatch(/aria-busy=\{isPending\}/)
    expect(src).toMatch(/aria-disabled=\{isPending\}/)
    expect(src).toMatch(/if \(isPending\) return/)
  })
})
