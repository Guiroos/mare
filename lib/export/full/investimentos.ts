// lib/export/full/investimentos.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { InvestmentEntryRow, WithdrawalRow } from '@/lib/queries/investments'
import { dateCell, headerRow, moneyCell, textCell } from '../xlsx'

const DESTINO_LABELS: Record<string, string> = {
  income: 'Caixa',
  reinvest: 'Reinvestimento',
  transfer: 'Transferência',
}

type TypeRow = {
  name: string
  maturityDate: string | null
  archived: boolean
}

export const TIPOS_HEADERS = ['Nome', 'Vencimento', 'Situação']
export const TIPOS_WIDTHS = [24, 14, 14]

export const APORTES_HEADERS = [
  'Mês de referência',
  'Tipo',
  'Aporte',
  'Rendimento',
  'Fora do fluxo de caixa',
  'Observações',
]
export const APORTES_WIDTHS = [18, 24, 14, 14, 22, 30]

export const RESGATES_HEADERS = [
  'Data',
  'Tipo',
  'Valor líquido',
  'Imposto',
  'Valor bruto',
  'Destino',
  'Observações',
]
export const RESGATES_WIDTHS = [12, 24, 16, 14, 16, 18, 30]

function tipoRow(type: TypeRow): Row {
  return [
    textCell(type.name),
    type.maturityDate ? dateCell(type.maturityDate) : textCell(null),
    textCell(type.archived ? 'Arquivado' : 'Ativo'),
  ]
}

export function buildTiposRows(types: TypeRow[]): SheetData {
  return [headerRow(TIPOS_HEADERS), ...types.map(tipoRow)]
}

function aporteRow(entry: InvestmentEntryRow): Row {
  return [
    textCell(entry.referenceMonth),
    textCell(entry.typeName),
    moneyCell(entry.amount),
    moneyCell(entry.yieldAmount),
    textCell(entry.excludeFromCashFlow ? 'Sim' : 'Não'),
    textCell(entry.notes),
  ]
}

export function buildAportesRows(entries: InvestmentEntryRow[]): SheetData {
  return [headerRow(APORTES_HEADERS), ...entries.map(aporteRow)]
}

/**
 * investmentWithdrawals.amount é LÍQUIDO (bruto − imposto). O bruto vai em coluna
 * própria em vez de deixar o usuário somar: essa distinção já foi fonte de erro
 * dentro do próprio app (ver .claude/domain.md).
 */
function resgateRow(withdrawal: WithdrawalRow): Row {
  const tax = withdrawal.taxAmount ?? 0
  return [
    dateCell(withdrawal.date),
    textCell(withdrawal.typeName),
    moneyCell(withdrawal.amount),
    withdrawal.taxAmount != null ? moneyCell(withdrawal.taxAmount) : textCell(null),
    moneyCell(withdrawal.amount + tax),
    textCell(DESTINO_LABELS[withdrawal.destination] ?? withdrawal.destination),
    textCell(withdrawal.notes),
  ]
}

export function buildResgatesRows(withdrawals: WithdrawalRow[]): SheetData {
  return [headerRow(RESGATES_HEADERS), ...withdrawals.map(resgateRow)]
}
