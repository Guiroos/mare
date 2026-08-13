import { describe, it, expect } from 'vitest'
import { chargesForMonth } from '@/components/share/SharedChargeList'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

const charge = (id: string, entryDate: string, amount: number): OpenChargeForLinking => ({
  id,
  description: `Cobrança ${id}`,
  amount,
  entryDate,
})

const charges: OpenChargeForLinking[] = [
  charge('a', '2026-03-12', 45),
  charge('b', '2026-03-18', 30),
  charge('c', '2026-04-02', 100),
]

describe('chargesForMonth', () => {
  it('returns every charge and the full total when no month is selected', () => {
    const { visible, total } = chargesForMonth(charges, 'all')

    expect(visible).toHaveLength(3)
    expect(total).toBe(175)
  })

  it('totals only the selected month, not every charge', () => {
    // Caso central: uma implementação que somasse `charges` em vez de
    // `visible` devolveria 175 aqui e passaria em todos os outros casos.
    const { visible, total } = chargesForMonth(charges, '2026-03')

    expect(visible.map((c) => c.id)).toEqual(['a', 'b'])
    expect(total).toBe(75)
  })

  it('filters by entryDate, not by a month embedded elsewhere in the string', () => {
    // '2026-04-03' começa com '2026-04'; se o filtro procurasse a substring em
    // qualquer posição, o dia 03 vazaria para o mês de março.
    const { visible } = chargesForMonth([charge('d', '2026-04-03', 10)], '2026-03')

    expect(visible).toEqual([])
  })

  it('returns zero for a month with no charges', () => {
    const { visible, total } = chargesForMonth(charges, '2026-12')

    expect(visible).toEqual([])
    expect(total).toBe(0)
  })

  it('sums decimal amounts without float drift', () => {
    const cents = [charge('e', '2026-05-01', 0.1), charge('f', '2026-05-02', 0.2)]

    expect(chargesForMonth(cents, '2026-05').total).toBeCloseTo(0.3, 10)
  })
})
