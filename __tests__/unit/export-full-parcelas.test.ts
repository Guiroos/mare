import { describe, expect, it } from 'vitest'
import { buildParcelasRows, PARCELAS_HEADERS } from '@/lib/export/full/parcelas'
import type { InstallmentGroupRow } from '@/lib/queries/parcelas'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

function grupo(overrides: Partial<InstallmentGroupRow> = {}): InstallmentGroupRow {
  return {
    id: 'g1',
    name: 'Notebook',
    categoryId: 'c1',
    accountId: 'a1',
    accountName: 'Nubank',
    categoryName: 'Eletrônicos',
    categoryColor: undefined,
    startDate: '2025-01-05',
    nextChargeMonth: '2025-03',
    nextChargeDate: '2025-03-05',
    totalAmount: 1200,
    totalInstallments: 12,
    paidInstallments: 2,
    remainingInstallments: 10,
    installmentAmount: 100,
    remainingAmount: 1000,
    ...overrides,
  }
}

describe('buildParcelasRows', () => {
  it('emite grupo quitado, não só os ativos', () => {
    const rows = buildParcelasRows([
      grupo({ id: 'ativo', name: 'Ativo' }),
      grupo({
        id: 'quitado',
        name: 'Quitado',
        paidInstallments: 12,
        remainingInstallments: 0,
        remainingAmount: 0,
      }),
    ])

    expect(values(rows[0])).toEqual(PARCELAS_HEADERS)
    expect(rows).toHaveLength(3)
    expect(values(rows[2])[0]).toBe('Quitado')
    expect(values(rows[2])[7]).toBe(12)
    expect(values(rows[2])[8]).toBe(0)
  })

  it('emite a data de início como Date, não texto', () => {
    const rows = buildParcelasRows([grupo()])
    expect((rows[1][4] as { value: unknown }).value).toBeInstanceOf(Date)
  })

  it('lista vazia produz só o cabeçalho', () => {
    expect(buildParcelasRows([])).toHaveLength(1)
  })
})
