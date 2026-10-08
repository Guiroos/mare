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
describe('pages não decidem regime de fatura por conta própria', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('dashboard/page.tsx usa o predicado do mês, não o modo do usuário', () => {
    const src = read('app/(app)/dashboard/page.tsx')
    expect(src).not.toMatch(/isFaturaMode\s*\?\s*faturaCtx/)
    expect(src).not.toMatch(/faturaCtx\s*&&\s*creditIdSet/)
  })

  it('configuracao-mes passa creditAccountIds ao FixedExpenseList via isFaturaMonth', () => {
    const src = read('app/(app)/configuracao-mes/page.tsx')
    expect(src).toContain('isFaturaMonth(')
    expect(src).toMatch(/<FixedExpenseList[\s\S]*?creditAccountIds=/)
    expect(src).not.toContain("creditMode === 'fatura'")
  })
})
