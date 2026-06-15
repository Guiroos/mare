// __tests__/unit/historico-merge.test.ts
import { describe, it, expect } from 'vitest'
import { mergeAndSortFeedItems } from '@/lib/queries/historico'
import type { HistoricoFeedItem } from '@/lib/queries/historico'

function makeItem(overrides: Partial<HistoricoFeedItem>): HistoricoFeedItem {
  return {
    id: 'id-1',
    kind: 'saida_avulsa',
    name: 'Item',
    amount: '100.00',
    date: '2025-06-10',
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categoryBgColor: null,
    accountId: null,
    accountName: null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: null,
    ...overrides,
  }
}

describe('mergeAndSortFeedItems', () => {
  it('ordena por data descendente', () => {
    const items = [
      makeItem({ id: 'a', date: '2025-06-01' }),
      makeItem({ id: 'b', date: '2025-06-15' }),
      makeItem({ id: 'c', date: '2025-06-08' }),
    ]
    const result = mergeAndSortFeedItems([items])
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('itens com mesma data mantêm ordem de inserção (stable sort)', () => {
    const items = [
      makeItem({ id: 'x', date: '2025-06-10' }),
      makeItem({ id: 'y', date: '2025-06-10' }),
    ]
    const result = mergeAndSortFeedItems([items])
    expect(result.map((i) => i.id)).toEqual(['x', 'y'])
  })

  it('merge de múltiplos arrays', () => {
    const a = [makeItem({ id: 'a', date: '2025-06-15' })]
    const b = [makeItem({ id: 'b', date: '2025-06-12' })]
    const c = [makeItem({ id: 'c', date: '2025-06-20' })]
    const result = mergeAndSortFeedItems([a, b, c])
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('retorna array vazio para inputs vazios', () => {
    expect(mergeAndSortFeedItems([[], [], []])).toEqual([])
  })
})
