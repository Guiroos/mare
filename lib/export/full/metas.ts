// lib/export/full/metas.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { GoalWithProgress } from '@/lib/queries/goals'
import { dateCell, headerRow, moneyCell, textCell } from '../xlsx'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  investment: 'Investimento',
}

export const METAS_HEADERS = [
  'Nome',
  'Valor alvo',
  'Data alvo',
  'Tipo de investimento',
  'Saldo atual',
  'Progresso (%)',
]
export const METAS_WIDTHS = [28, 14, 14, 24, 14, 16]

export const CONTRIBUICOES_HEADERS = ['Meta', 'Mês de referência', 'Valor', 'Origem']
export const CONTRIBUICOES_WIDTHS = [28, 18, 14, 18]

function metaRow(goal: GoalWithProgress): Row {
  return [
    textCell(goal.name),
    moneyCell(goal.targetAmount),
    goal.targetDate ? dateCell(goal.targetDate) : textCell(null),
    textCell(goal.investmentTypeName),
    moneyCell(goal.currentBalance),
    { value: Math.round(goal.progress), type: Number },
  ]
}

export function buildMetasRows(goals: GoalWithProgress[]): SheetData {
  return [headerRow(METAS_HEADERS), ...goals.map(metaRow)]
}

/**
 * As contribuições já vêm aninhadas e decriptadas em GoalWithProgress.contributions
 * — não existe (nem precisa existir) query própria para elas.
 */
export function buildContribuicoesRows(goals: GoalWithProgress[]): SheetData {
  const rows: Row[] = []
  for (const goal of goals) {
    for (const contribution of goal.contributions) {
      rows.push([
        textCell(goal.name),
        textCell(contribution.referenceMonth),
        moneyCell(contribution.amount),
        textCell(SOURCE_LABELS[contribution.source] ?? contribution.source),
      ])
    }
  }
  return [headerRow(CONTRIBUICOES_HEADERS), ...rows]
}
