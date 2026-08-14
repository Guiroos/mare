import { describe, expect, it } from 'vitest'
import {
  APORTES_HEADERS,
  buildAportesRows,
  buildResgatesRows,
  buildTiposRows,
  RESGATES_HEADERS,
  TIPOS_HEADERS,
} from '@/lib/export/full/investimentos'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

describe('buildResgatesRows', () => {
  it('calcula o valor bruto como líquido + imposto', () => {
    const rows = buildResgatesRows([
      {
        id: 'w1',
        investmentTypeId: 't1',
        typeName: 'CDB',
        amount: 900,
        taxAmount: 100,
        date: '2025-04-10',
        destination: 'income',
        notes: null,
      },
    ])

    expect(values(rows[0])).toEqual(RESGATES_HEADERS)
    // Data, Tipo, Líquido, Imposto, Bruto, Destino, Observações
    expect(values(rows[1]).slice(2, 6)).toEqual([900, 100, 1000, 'Caixa'])
  })

  it('trata imposto nulo como zero no bruto', () => {
    const rows = buildResgatesRows([
      {
        id: 'w2',
        investmentTypeId: 't1',
        typeName: 'CDB',
        amount: 500,
        taxAmount: null,
        date: '2025-05-10',
        destination: 'reinvest',
        notes: null,
      },
    ])

    expect(values(rows[1]).slice(2, 6)).toEqual([500, '', 500, 'Reinvestimento'])
  })
})

describe('buildAportesRows', () => {
  it('emite a flag de fluxo de caixa como Sim/Não', () => {
    const rows = buildAportesRows([
      {
        id: 'i1',
        referenceMonth: '2025-03-01',
        typeName: 'Tesouro',
        amount: 500,
        yieldAmount: 25.5,
        excludeFromCashFlow: true,
        notes: 'rolagem',
      },
    ])

    expect(values(rows[0])).toEqual(APORTES_HEADERS)
    expect(values(rows[1])).toEqual(['2025-03-01', 'Tesouro', 500, 25.5, 'Sim', 'rolagem'])
  })
})

describe('buildTiposRows', () => {
  it('marca arquivado e vencimento vazio', () => {
    const rows = buildTiposRows([{ name: 'CDB', maturityDate: null, archived: true }])

    expect(values(rows[0])).toEqual(TIPOS_HEADERS)
    expect(values(rows[1])).toEqual(['CDB', '', 'Arquivado'])
  })
})
