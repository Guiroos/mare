import { describe, expect, it } from 'vitest'
import { buildContasRows, CONTAS_HEADERS } from '@/lib/export/full/contas'
import {
  buildCategoriasRows,
  buildOrcamentosRows,
  CATEGORIAS_HEADERS,
  ORCAMENTOS_HEADERS,
} from '@/lib/export/full/categorias'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

describe('buildContasRows', () => {
  it('traduz o tipo e mantém o dia de fechamento', () => {
    const rows = buildContasRows([
      { name: 'Nubank', type: 'credit', closingDay: 8 },
      { name: 'Carteira', type: 'pix', closingDay: null },
    ])

    expect(values(rows[0])).toEqual(CONTAS_HEADERS)
    expect(values(rows[1])).toEqual(['Nubank', 'Crédito', 8])
    expect(values(rows[2])).toEqual(['Carteira', 'Pix', ''])
  })

  it('lista vazia produz só o cabeçalho', () => {
    expect(buildContasRows([])).toHaveLength(1)
  })
})

describe('buildCategoriasRows', () => {
  it('achata grupo × categoria, uma linha por categoria', () => {
    const rows = buildCategoriasRows([
      {
        name: 'Essenciais',
        categories: [
          { name: 'Mercado', defaultBudget: '800.00', color: '#111111' },
          { name: 'Transporte', defaultBudget: null, color: null },
        ],
      },
    ])

    expect(values(rows[0])).toEqual(CATEGORIAS_HEADERS)
    expect(values(rows[1])).toEqual(['Essenciais', 'Mercado', 800, '#111111'])
    expect(values(rows[2])).toEqual(['Essenciais', 'Transporte', '', ''])
  })
})

describe('buildOrcamentosRows', () => {
  it('emite uma linha por mês da mesma categoria', () => {
    const rows = buildOrcamentosRows([
      {
        referenceMonth: '2024-01-01',
        groupName: 'Essenciais',
        categoryName: 'Mercado',
        amount: 300,
      },
      {
        referenceMonth: '2024-02-01',
        groupName: 'Essenciais',
        categoryName: 'Mercado',
        amount: 450,
      },
    ])

    expect(values(rows[0])).toEqual(ORCAMENTOS_HEADERS)
    expect(rows).toHaveLength(3)
    expect(values(rows[1])).toEqual(['2024-01-01', 'Essenciais', 'Mercado', 300])
    expect(values(rows[2])).toEqual(['2024-02-01', 'Essenciais', 'Mercado', 450])
  })
})
