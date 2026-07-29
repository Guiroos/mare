// __tests__/unit/export-devedores.test.ts
import { describe, it, expect } from 'vitest'
import {
  LANCAMENTOS_HEADERS,
  SALDOS_HEADERS,
  buildLancamentosRows,
  buildSaldosRows,
  signedEntryAmount,
  writeDevedoresXlsx,
} from '@/lib/export/devedores-xlsx'
import type { DebtorEntryExportRow, PersonWithBalance } from '@/lib/queries/debtors'

function makeEntry(overrides: Partial<DebtorEntryExportRow>): DebtorEntryExportRow {
  return {
    personName: 'Ana',
    type: 'charge',
    amount: 100,
    description: 'Jantar',
    referenceMonth: '2026-06-01',
    entryDate: '2026-06-10',
    status: 'open',
    notes: null,
    ...overrides,
  }
}

function makePerson(overrides: Partial<PersonWithBalance>): PersonWithBalance {
  return {
    id: 'p1',
    name: 'Ana',
    email: null,
    phone: null,
    notes: null,
    archived: false,
    balance: 0,
    lastMovement: null,
    ...overrides,
  }
}

describe('signedEntryAmount', () => {
  it('mantém cobrança positiva', () => {
    expect(signedEntryAmount(makeEntry({ type: 'charge', amount: 100 }))).toBe(100)
  })

  it('torna pagamento negativo', () => {
    expect(signedEntryAmount(makeEntry({ type: 'payment', amount: 40 }))).toBe(-40)
  })

  it('mantém ajuste como armazenado, inclusive negativo', () => {
    expect(signedEntryAmount(makeEntry({ type: 'adjustment', amount: -15 }))).toBe(-15)
    expect(signedEntryAmount(makeEntry({ type: 'adjustment', amount: 15 }))).toBe(15)
  })

  it('a soma dos lançamentos de uma pessoa reproduz o saldo dela', () => {
    const entries = [
      makeEntry({ type: 'charge', amount: 100 }),
      makeEntry({ type: 'charge', amount: 50 }),
      makeEntry({ type: 'payment', amount: 40 }),
      makeEntry({ type: 'adjustment', amount: -10 }),
    ]
    const total = entries.reduce((acc, e) => acc + signedEntryAmount(e), 0)
    expect(total).toBe(100)
  })
})

describe('buildSaldosRows', () => {
  it('começa pelo cabeçalho', () => {
    const rows = buildSaldosRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(SALDOS_HEADERS.length)
    expect(rows[0][0]).toMatchObject({ value: 'Pessoa', fontWeight: 'bold' })
  })

  it('monta a linha de uma pessoa com contato e saldo', () => {
    const rows = buildSaldosRows([
      makePerson({
        name: 'Ana',
        email: 'ana@x.com',
        phone: '11999998888',
        balance: 250.5,
        lastMovement: '2026-06-10',
      }),
    ])
    expect(rows[1][0]).toMatchObject({ value: 'Ana' })
    expect(rows[1][1]).toMatchObject({ value: 'ana@x.com' })
    expect(rows[1][2]).toMatchObject({ value: '11999998888' })
    expect(rows[1][3]).toMatchObject({ value: 250.5, type: Number })
    expect(rows[1][4]).toMatchObject({ type: Date })
  })

  it('deixa a célula de último movimento vazia quando não há movimentação', () => {
    const rows = buildSaldosRows([makePerson({ lastMovement: null })])
    expect(rows[1][4]).toMatchObject({ value: '' })
  })

  it('deixa email e telefone vazios quando nulos', () => {
    const rows = buildSaldosRows([makePerson({ email: null, phone: null })])
    expect(rows[1][1]).toMatchObject({ value: '' })
    expect(rows[1][2]).toMatchObject({ value: '' })
  })
})

describe('buildLancamentosRows', () => {
  it('começa pelo cabeçalho', () => {
    const rows = buildLancamentosRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(LANCAMENTOS_HEADERS.length)
  })

  it('rotula os três tipos em pt-BR', () => {
    const rows = buildLancamentosRows([
      makeEntry({ type: 'charge' }),
      makeEntry({ type: 'payment' }),
      makeEntry({ type: 'adjustment' }),
    ])
    expect(rows.slice(1).map((r) => (r[2] as { value: string }).value)).toEqual([
      'Cobrança',
      'Pagamento',
      'Ajuste',
    ])
  })

  it('traduz o status e trata null', () => {
    const rows = buildLancamentosRows([
      makeEntry({ status: 'open' }),
      makeEntry({ status: 'settled' }),
      makeEntry({ status: null }),
    ])
    expect(rows.slice(1).map((r) => (r[6] as { value: string }).value)).toEqual([
      'Em aberto',
      'Quitada',
      '',
    ])
  })

  it('emite data como Date e valor com sinal', () => {
    const rows = buildLancamentosRows([
      makeEntry({ type: 'payment', amount: 40, entryDate: '2026-06-10' }),
    ])
    expect(rows[1][1]).toMatchObject({ type: Date })
    expect(rows[1][4]).toMatchObject({ value: -40, type: Number })
  })
})

describe('writeDevedoresXlsx', () => {
  it('gera um xlsx válido com as duas abas', async () => {
    const buffer = await writeDevedoresXlsx([makePerson({ balance: 100 })], [makeEntry({})])

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 2).toString()).toBe('PK')

    // O nome das abas fica em xl/workbook.xml, dentro do zip.
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(new Uint8Array(buffer))
    const workbook = strFromU8(files['xl/workbook.xml'])
    expect(workbook).toContain('Saldos')
    expect(workbook).toContain('Lançamentos')
  })
})
