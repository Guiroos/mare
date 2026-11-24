import { describe, it, expect } from 'vitest'
import { sumHistoricoItems } from '@/lib/utils/historico-totals'
import type { HistoricoFeedItem } from '@/lib/queries/historico'

function item(overrides: Partial<HistoricoFeedItem>): HistoricoFeedItem {
  return {
    id: 'id',
    kind: 'saida_avulsa',
    name: 'Item',
    amount: '0',
    date: '2026-06-10',
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categoryBgColor: null,
    accountId: null,
    accountName: null,
    installmentNumber: null,
    totalInstallments: null,
    investmentTypeName: null,
    isFaturaPayment: false,
    ...overrides,
  }
}

describe('sumHistoricoItems', () => {
  it('não conta pagamento de fatura como saída', () => {
    const r = sumHistoricoItems([
      item({ amount: '500.00' }),
      item({ amount: '800.00', isFaturaPayment: true }),
    ])
    expect(r.saidas).toBe(500)
  })

  it('soma entradas, saídas e investido', () => {
    const r = sumHistoricoItems([
      item({ kind: 'entrada', amount: '1000' }),
      item({ kind: 'saida_fixa', amount: '200' }),
      item({ kind: 'investimento', amount: '50' }),
    ])
    expect(r).toEqual({ entradas: 1000, saidas: 200, investido: 50 })
  })
})
