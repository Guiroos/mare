// __tests__/unit/historico-merge.test.ts
import { describe, it, expect } from 'vitest'
import {
  mergeAndSortFeedItems,
  fixedExpenseDate,
  referenceMonthsInRange,
} from '@/lib/queries/historico'
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

describe('fixedExpenseDate', () => {
  it('dueDay=1 retorna o próprio referenceMonth', () => {
    expect(fixedExpenseDate('2025-06-01', 1)).toBe('2025-06-01')
  })

  it('dueDay=15 retorna o dia 15 do mês', () => {
    expect(fixedExpenseDate('2025-06-01', 15)).toBe('2025-06-15')
  })

  it('dueDay=31 em mês com 31 dias retorna o último dia', () => {
    expect(fixedExpenseDate('2025-01-01', 31)).toBe('2025-01-31')
  })

  it('dueDay=31 em fevereiro transborda para março (caso capturado pelo filtro JS)', () => {
    expect(fixedExpenseDate('2025-02-01', 31)).toBe('2025-03-03')
  })

  it('dueDay=28 em fevereiro retorna 28/fev', () => {
    expect(fixedExpenseDate('2025-02-01', 28)).toBe('2025-02-28')
  })
})

describe('referenceMonthsInRange', () => {
  it('mesmo mês retorna um único elemento', () => {
    expect(referenceMonthsInRange('2025-06-10', '2025-06-20')).toEqual(['2025-06-01'])
  })

  it('dois meses consecutivos', () => {
    expect(referenceMonthsInRange('2025-05-15', '2025-06-10')).toEqual(['2025-05-01', '2025-06-01'])
  })

  it('três meses', () => {
    expect(referenceMonthsInRange('2025-05-01', '2025-07-31')).toEqual([
      '2025-05-01',
      '2025-06-01',
      '2025-07-01',
    ])
  })

  it('virada de ano', () => {
    expect(referenceMonthsInRange('2024-12-15', '2025-01-10')).toEqual(['2024-12-01', '2025-01-01'])
  })

  it('de e ate no mesmo dia retorna um mês', () => {
    expect(referenceMonthsInRange('2025-03-15', '2025-03-15')).toEqual(['2025-03-01'])
  })
})
