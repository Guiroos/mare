// __tests__/unit/export-extrato.test.ts
import { describe, it, expect } from 'vitest'
import {
  EXTRATO_HEADERS,
  buildExtratoRows,
  formatParcela,
  signedAmount,
  writeExtratoXlsx,
} from '@/lib/export/extrato-xlsx'
import type { HistoricoFeedItem } from '@/lib/queries/historico'

function makeItem(overrides: Partial<HistoricoFeedItem>): HistoricoFeedItem {
  return {
    id: 'id-1',
    kind: 'saida_avulsa',
    name: 'Item',
    amount: '100.00',
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
    ...overrides,
  }
}

describe('signedAmount', () => {
  it('torna saídas negativas', () => {
    expect(signedAmount(makeItem({ kind: 'saida_avulsa' }))).toBe(-100)
    expect(signedAmount(makeItem({ kind: 'saida_fixa' }))).toBe(-100)
    expect(signedAmount(makeItem({ kind: 'saida_parcelada' }))).toBe(-100)
  })

  it('torna aportes negativos, seguindo o dashboard que subtrai investido do saldo', () => {
    expect(signedAmount(makeItem({ kind: 'investimento' }))).toBe(-100)
  })

  it('mantém entradas e resgates positivos', () => {
    expect(signedAmount(makeItem({ kind: 'entrada' }))).toBe(100)
    expect(signedAmount(makeItem({ kind: 'resgate' }))).toBe(100)
  })

  it('somar a coluna reproduz o saldo do período', () => {
    const items = [
      makeItem({ kind: 'entrada', amount: '5000.00' }),
      makeItem({ kind: 'saida_avulsa', amount: '1200.50' }),
      makeItem({ kind: 'investimento', amount: '800.00' }),
    ]
    const total = items.reduce((acc, i) => acc + signedAmount(i), 0)
    expect(total).toBeCloseTo(2999.5, 2)
  })
})

describe('formatParcela', () => {
  it('formata número e total', () => {
    expect(formatParcela(makeItem({ installmentNumber: 3, totalInstallments: 12 }))).toBe('3/12')
  })

  it('devolve vazio quando não é parcelado', () => {
    expect(formatParcela(makeItem({}))).toBe('')
  })

  it('devolve vazio quando só um dos dois campos está preenchido', () => {
    expect(formatParcela(makeItem({ installmentNumber: 3 }))).toBe('')
    expect(formatParcela(makeItem({ totalInstallments: 12 }))).toBe('')
  })
})

describe('buildExtratoRows', () => {
  it('começa pelo cabeçalho em negrito', () => {
    const rows = buildExtratoRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(EXTRATO_HEADERS.length)
    expect(rows[0][0]).toMatchObject({ value: 'Data', fontWeight: 'bold' })
  })

  it('monta a linha completa de uma saída avulsa', () => {
    const rows = buildExtratoRows([
      makeItem({
        kind: 'saida_avulsa',
        name: 'Mercado',
        amount: '250.75',
        date: '2026-06-10',
        categoryName: 'Alimentação',
        accountName: 'Nubank',
      }),
    ])
    const row = rows[1]
    expect(row[1]).toMatchObject({ value: 'Saída avulsa' })
    expect(row[2]).toMatchObject({ value: 'Mercado' })
    expect(row[3]).toMatchObject({ value: -250.75, type: Number })
    expect(row[4]).toMatchObject({ value: 'Alimentação' })
    expect(row[5]).toMatchObject({ value: 'Nubank' })
    expect(row[6]).toMatchObject({ value: '' })
    expect(row[7]).toMatchObject({ value: '' })
  })

  it('emite a data como Date, não texto', () => {
    const rows = buildExtratoRows([makeItem({ date: '2026-06-10' })])
    expect(rows[1][0]).toMatchObject({ type: Date })
    expect((rows[1][0] as { value: Date }).value).toBeInstanceOf(Date)
  })

  it('deixa categoria e conta vazias quando nulas', () => {
    const rows = buildExtratoRows([
      makeItem({ kind: 'entrada', categoryName: null, accountName: null }),
    ])
    expect(rows[1][4]).toMatchObject({ value: '' })
    expect(rows[1][5]).toMatchObject({ value: '' })
  })

  it('preenche a coluna de investimento em aportes e resgates', () => {
    const rows = buildExtratoRows([makeItem({ kind: 'resgate', investmentTypeName: 'CDB Inter' })])
    expect(rows[1][7]).toMatchObject({ value: 'CDB Inter' })
  })

  it('rotula todos os tipos em pt-BR', () => {
    const kinds = [
      'saida_avulsa',
      'saida_fixa',
      'saida_parcelada',
      'entrada',
      'investimento',
      'resgate',
    ] as const
    const rows = buildExtratoRows(kinds.map((kind) => makeItem({ kind })))
    expect(rows.slice(1).map((r) => (r[1] as { value: string }).value)).toEqual([
      'Saída avulsa',
      'Saída fixa',
      'Saída parcelada',
      'Entrada',
      'Investimento',
      'Resgate',
    ])
  })
})

describe('writeExtratoXlsx', () => {
  it('gera um arquivo xlsx válido com a aba nomeada', async () => {
    const buffer = await writeExtratoXlsx([
      makeItem({ kind: 'entrada', name: 'Salário', amount: '5000.00' }),
    ])

    expect(Buffer.isBuffer(buffer)).toBe(true)
    // Assinatura de arquivo ZIP — todo .xlsx é um zip.
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    expect(buffer.length).toBeGreaterThan(1000)
  })
})
