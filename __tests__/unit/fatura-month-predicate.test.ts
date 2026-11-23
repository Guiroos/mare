import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/crypto/keys', () => ({ getDekForUser: vi.fn() }))

import { isFaturaMonth } from '@/lib/queries/fatura'

const ctx = {
  creditMode: 'fatura' as const,
  faturaActiveFrom: '2025-06-01',
  creditAccountIds: ['x'],
}

describe('isFaturaMonth', () => {
  it('mês anterior à ativação não é mês de fatura', () => {
    expect(isFaturaMonth('2025-05-01', ctx)).toBe(false)
  })
  it('mês da ativação e posteriores são mês de fatura', () => {
    expect(isFaturaMonth('2025-06-01', ctx)).toBe(true)
    expect(isFaturaMonth('2025-07-01', ctx)).toBe(true)
  })
  it('accrual, sem contexto ou sem faturaActiveFrom nunca é mês de fatura', () => {
    expect(isFaturaMonth('2025-07-01', { ...ctx, creditMode: 'accrual' })).toBe(false)
    expect(isFaturaMonth('2025-07-01')).toBe(false)
    expect(isFaturaMonth('2025-07-01', { ...ctx, faturaActiveFrom: null })).toBe(false)
  })
})

// Gate de fonte (sem infra de render): as pages não podem reexpressar o predicado.
// Toda prop `creditAccountIds=` tem de vir de `viaFaturaAccountIds`, e essa variável
// tem de nascer do predicado do mês — não de `isFaturaMode` nem de lista incondicional.
describe('pages não decidem regime de fatura por conta própria', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const creditProps = (src: string) => src.match(/creditAccountIds=\{[^}]*\}/g) ?? []

  it('dashboard/page.tsx deriva as contas via fatura de creditFilteredFromBudget', () => {
    const src = read('app/(app)/dashboard/page.tsx')
    expect(src).toMatch(/viaFaturaAccountIds\s*=\s*data\.creditFilteredFromBudget\s*\?/)
    const props = creditProps(src)
    expect(props).toHaveLength(2)
    for (const prop of props) expect(prop).toBe('creditAccountIds={viaFaturaAccountIds}')
    expect(src).toMatch(
      /fixedForPendency\s*=\s*data\.fixedExpenses\.filter\(\(e\) => !viaFaturaIdSet\.has/
    )
  })

  it('configuracao-mes deriva as contas via fatura de isFaturaMonth', () => {
    const src = read('app/(app)/configuracao-mes/page.tsx')
    expect(src).toMatch(/viaFaturaAccountIds\s*=\s*isFaturaMonth\(referenceMonth,/)
    const props = creditProps(src)
    expect(props).toHaveLength(1)
    expect(props[0]).toBe('creditAccountIds={viaFaturaAccountIds}')
    expect(src).not.toContain("creditMode === 'fatura'")
  })
})
