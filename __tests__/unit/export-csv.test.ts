// __tests__/unit/export-csv.test.ts
import { describe, it, expect } from 'vitest'
import { sheetToCsv, toCsvResponse } from '@/lib/export/csv'
import { dateCell, headerRow, moneyCell, textCell } from '@/lib/export/xlsx'

const BOM = '﻿'

describe('sheetToCsv', () => {
  it('começa com BOM UTF-8 para o Excel abrir com acentos corretos', () => {
    const csv = sheetToCsv([[textCell('Ação')]])
    expect(csv.startsWith(BOM)).toBe(true)
  })

  it('usa ; como delimitador (vírgula é decimal no Excel pt-BR)', () => {
    const csv = sheetToCsv([[textCell('a'), textCell('b')]])
    expect(csv).toBe(`${BOM}a;b`)
  })

  it('formata número com vírgula decimal e duas casas', () => {
    const csv = sheetToCsv([[moneyCell(-123.4)]])
    expect(csv).toBe(`${BOM}-123,40`)
  })

  it('formata data como dd/mm/yyyy no dia correto', () => {
    const csv = sheetToCsv([[dateCell('2026-07-10')]])
    expect(csv).toBe(`${BOM}10/07/2026`)
  })

  it('escapa campos com ; aspas ou quebra de linha', () => {
    const csv = sheetToCsv([[textCell('Mercado; feira'), textCell('Ana "Nina"')]])
    expect(csv).toBe(`${BOM}"Mercado; feira";"Ana ""Nina"""`)
  })

  it('separa linhas com CRLF e converte célula vazia em campo vazio', () => {
    const csv = sheetToCsv([headerRow(['Data', 'Valor']), [textCell(null), moneyCell(0)]])
    expect(csv).toBe(`${BOM}Data;Valor\r\n;0,00`)
  })
})

describe('toCsvResponse', () => {
  it('devolve os headers de download com content-type text/csv', () => {
    const res = toCsvResponse('conteudo', 'mare-extrato.csv')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="mare-extrato.csv"')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
