// lib/export/full/contas.ts
import type { Row, SheetData } from 'write-excel-file/node'
import { headerRow, textCell } from '../xlsx'

type AccountRow = {
  name: string
  type: string
  closingDay: number | null
}

const TIPO_LABELS: Record<string, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
}

export const CONTAS_HEADERS = ['Nome', 'Tipo', 'Dia de fechamento']

export const CONTAS_WIDTHS = [24, 14, 18]

function contaRow(account: AccountRow): Row {
  return [
    textCell(account.name),
    textCell(TIPO_LABELS[account.type] ?? account.type),
    account.closingDay != null ? { value: account.closingDay, type: Number } : textCell(null),
  ]
}

export function buildContasRows(accounts: AccountRow[]): SheetData {
  return [headerRow(CONTAS_HEADERS), ...accounts.map(contaRow)]
}
