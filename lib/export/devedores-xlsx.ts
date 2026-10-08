// lib/export/devedores-xlsx.ts
import writeXlsxFile from 'write-excel-file/node'
import type { Row, SheetData } from 'write-excel-file/node'
import { signedDebtAmount } from '@/lib/queries/debtors'
import type { DebtorEntryExportRow, PersonWithBalance } from '@/lib/queries/debtors'
import { dateCell, headerRow, moneyCell, textCell } from './xlsx'

const TIPO_LABELS: Record<DebtorEntryExportRow['type'], string> = {
  charge: 'Cobrança',
  payment: 'Pagamento',
  adjustment: 'Ajuste',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Em aberto',
  settled: 'Quitada',
}

export const SALDOS_HEADERS = ['Pessoa', 'Email', 'Telefone', 'Saldo', 'Último movimento']

export const LANCAMENTOS_HEADERS = [
  'Pessoa',
  'Data',
  'Tipo',
  'Descrição',
  'Valor',
  'Mês de referência',
  'Status',
  'Observações',
]

const SALDOS_WIDTHS = [{ width: 24 }, { width: 26 }, { width: 16 }, { width: 14 }, { width: 16 }]

const LANCAMENTOS_WIDTHS = [
  { width: 24 },
  { width: 12 },
  { width: 14 },
  { width: 40 },
  { width: 14 },
  { width: 18 },
  { width: 14 },
  { width: 30 },
]

function saldoRow(person: PersonWithBalance): Row {
  return [
    textCell(person.name),
    textCell(person.email),
    textCell(person.phone),
    moneyCell(person.balance),
    person.lastMovement ? dateCell(person.lastMovement) : textCell(null),
  ]
}

function lancamentoRow(entry: DebtorEntryExportRow): Row {
  return [
    textCell(entry.personName),
    dateCell(entry.entryDate),
    textCell(TIPO_LABELS[entry.type]),
    textCell(entry.description),
    moneyCell(signedDebtAmount(entry)),
    textCell(entry.referenceMonth),
    textCell(entry.status ? (STATUS_LABELS[entry.status] ?? entry.status) : null),
    textCell(entry.notes),
  ]
}

export function buildSaldosRows(people: PersonWithBalance[]): SheetData {
  return [headerRow(SALDOS_HEADERS), ...people.map(saldoRow)]
}

export function buildLancamentosRows(entries: DebtorEntryExportRow[]): SheetData {
  return [headerRow(LANCAMENTOS_HEADERS), ...entries.map(lancamentoRow)]
}

export function writeDevedoresXlsx(
  people: PersonWithBalance[],
  entries: DebtorEntryExportRow[]
): Promise<Buffer> {
  return writeXlsxFile(
    [
      {
        sheet: 'Saldos',
        stickyRowsCount: 1,
        columns: SALDOS_WIDTHS,
        data: buildSaldosRows(people),
      },
      {
        sheet: 'Lançamentos',
        stickyRowsCount: 1,
        columns: LANCAMENTOS_WIDTHS,
        data: buildLancamentosRows(entries),
      },
    ],
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}

export function writePessoaXlsx(entries: DebtorEntryExportRow[]): Promise<Buffer> {
  return writeXlsxFile(
    [
      {
        sheet: 'Lançamentos',
        stickyRowsCount: 1,
        columns: LANCAMENTOS_WIDTHS,
        data: buildLancamentosRows(entries),
      },
    ],
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}
