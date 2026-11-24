import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Controles de expandir/recolher precisam expor o estado (WCAG 4.1.2, #117).
// Sem testing-library no projeto, a asserção é sobre o texto-fonte. Ancora na
// expressão de estado, não na palavra: `aria-expanded="true"` fixo passaria um
// match genérico e anunciaria todo acordeão como aberto.

const CASOS = [
  { file: 'components/investimentos/InvestmentTypeAccordion.tsx', expr: 'isOpen' },
  { file: 'components/devedores/DebtPaymentDialog.tsx', expr: 'chargesExpanded' },
]

describe('aria-expanded nos controles de expandir/recolher (#117)', () => {
  for (const { file, expr } of CASOS) {
    it(`${file} liga aria-expanded a ${expr}`, () => {
      const src = readFileSync(join(process.cwd(), file), 'utf-8')
      expect(src).toMatch(new RegExp(`aria-expanded=\\{${expr}\\}`))
    })
  }
})
