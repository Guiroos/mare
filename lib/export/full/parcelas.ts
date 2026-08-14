// lib/export/full/parcelas.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { InstallmentGroupRow } from '@/lib/queries/parcelas'
import { dateCell, headerRow, moneyCell, textCell } from '../xlsx'

export const PARCELAS_HEADERS = [
  'Descrição',
  'Valor total',
  'Nº de parcelas',
  'Valor da parcela',
  'Data de início',
  'Categoria',
  'Conta',
  'Parcelas pagas',
  'Restantes',
]

export const PARCELAS_WIDTHS = [36, 14, 14, 16, 14, 22, 20, 16, 12]

function parcelaRow(group: InstallmentGroupRow): Row {
  return [
    textCell(group.name),
    moneyCell(group.totalAmount),
    { value: group.totalInstallments, type: Number },
    moneyCell(group.installmentAmount),
    dateCell(group.startDate),
    textCell(group.categoryName),
    textCell(group.accountName),
    { value: group.paidInstallments, type: Number },
    { value: group.remainingInstallments, type: Number },
  ]
}

export function buildParcelasRows(groups: InstallmentGroupRow[]): SheetData {
  return [headerRow(PARCELAS_HEADERS), ...groups.map(parcelaRow)]
}
