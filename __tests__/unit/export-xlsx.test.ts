// __tests__/unit/export-xlsx.test.ts
import { describe, it, expect } from 'vitest'
import {
  dateCell,
  moneyCell,
  headerRow,
  slugifyForFilename,
  textCell,
  toXlsxResponse,
  tooManyRowsResponse,
} from '@/lib/export/xlsx'

describe('textCell', () => {
  it('converte null em string vazia', () => {
    expect(textCell(null)).toEqual({ value: '', type: String })
  })

  it('preserva o texto', () => {
    expect(textCell('Mercado')).toEqual({ value: 'Mercado', type: String })
  })
})

describe('dateCell', () => {
  it('emite uma Date real, no dia correto, e não texto', () => {
    const cell = dateCell('2026-07-10')
    expect(cell).toMatchObject({ type: Date, format: 'dd/mm/yyyy' })
    const value = (cell as { value: Date }).value
    expect(value).toBeInstanceOf(Date)
    expect(value.getFullYear()).toBe(2026)
    expect(value.getMonth()).toBe(6) // julho é 6
    expect(value.getDate()).toBe(10)
  })
})

describe('moneyCell', () => {
  it('emite número com formato de duas casas', () => {
    expect(moneyCell(-123.45)).toEqual({
      value: -123.45,
      type: Number,
      format: '#,##0.00',
    })
  })
})

describe('headerRow', () => {
  it('marca todas as células como negrito', () => {
    const row = headerRow(['Data', 'Valor'])
    expect(row).toEqual([
      { value: 'Data', type: String, fontWeight: 'bold' },
      { value: 'Valor', type: String, fontWeight: 'bold' },
    ])
  })
})

describe('slugifyForFilename', () => {
  it('remove acentuação e normaliza separadores', () => {
    expect(slugifyForFilename('João da Silva')).toBe('joao-da-silva')
  })

  it('remove aspas, que quebrariam o Content-Disposition', () => {
    expect(slugifyForFilename('Ana "Nina" Souza')).toBe('ana-nina-souza')
  })

  it('não deixa hífen sobrando nas pontas', () => {
    expect(slugifyForFilename('  Zé  ')).toBe('ze')
  })
})

describe('toXlsxResponse', () => {
  it('devolve os headers de download com o nome do arquivo', () => {
    const res = toXlsxResponse(Buffer.from('abc'), 'mare-extrato.xlsx')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="mare-extrato.xlsx"')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

describe('tooManyRowsResponse', () => {
  it('responde 413 com mensagem legível em pt-BR', async () => {
    const res = tooManyRowsResponse()
    expect(res.status).toBe(413)
    await expect(res.text()).resolves.toContain('Período muito grande')
  })
})
