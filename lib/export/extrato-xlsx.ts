// lib/export/extrato-xlsx.ts
import writeXlsxFile from 'write-excel-file/node'
import type { Row, SheetData } from 'write-excel-file/node'
import type { HistoricoFeedItem } from '@/lib/queries/historico'
import type { TipoKind } from '@/lib/utils/historico-params'
import { toAmount } from '@/lib/utils/currency'
import { dateCell, headerRow, moneyCell, textCell } from './xlsx'

const TIPO_LABELS: Record<TipoKind, string> = {
  saida_avulsa: 'Saída avulsa',
  saida_fixa: 'Saída fixa',
  saida_parcelada: 'Saída parcelada',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

/**
 * Tipos que saem do caixa. Aporte entra aqui por coerência com getDashboardData,
 * que subtrai o total investido do saldo.
 */
const NEGATIVE_KINDS: readonly TipoKind[] = [
  'saida_avulsa',
  'saida_fixa',
  'saida_parcelada',
  'investimento',
]

export const EXTRATO_HEADERS = [
  'Data',
  'Tipo',
  'Descrição',
  'Valor',
  'Categoria',
  'Conta',
  'Parcela',
  'Investimento',
]

const COLUMN_WIDTHS = [
  { width: 12 },
  { width: 16 },
  { width: 40 },
  { width: 14 },
  { width: 20 },
  { width: 18 },
  { width: 10 },
  { width: 20 },
]

export function signedAmount(item: HistoricoFeedItem): number {
  const value = toAmount(item.amount)
  return NEGATIVE_KINDS.includes(item.kind) ? -value : value
}

export function formatParcela(item: HistoricoFeedItem): string {
  if (item.installmentNumber == null || item.totalInstallments == null) return ''
  return `${item.installmentNumber}/${item.totalInstallments}`
}

function toRow(item: HistoricoFeedItem): Row {
  return [
    dateCell(item.date),
    textCell(TIPO_LABELS[item.kind]),
    textCell(item.name),
    moneyCell(signedAmount(item)),
    textCell(item.categoryName),
    textCell(item.accountName),
    textCell(formatParcela(item)),
    textCell(item.investmentTypeName),
  ]
}

export function buildExtratoRows(items: HistoricoFeedItem[]): SheetData {
  return [headerRow(EXTRATO_HEADERS), ...items.map(toRow)]
}

export function writeExtratoXlsx(items: HistoricoFeedItem[]): Promise<Buffer> {
  return writeXlsxFile(
    [
      {
        sheet: 'Extrato',
        stickyRowsCount: 1,
        columns: COLUMN_WIDTHS,
        data: buildExtratoRows(items),
      },
    ],
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}
