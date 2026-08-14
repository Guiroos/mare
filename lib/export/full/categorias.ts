// lib/export/full/categorias.ts
import type { Row, SheetData } from 'write-excel-file/node'
import type { BudgetOverrideRow } from '@/lib/queries/categories'
import { toAmount } from '@/lib/utils/currency'
import { headerRow, moneyCell, textCell } from '../xlsx'

type CategoryRow = {
  name: string
  defaultBudget: string | null
  color: string | null
}

type GroupRow = {
  name: string
  categories: CategoryRow[]
}

export const CATEGORIAS_HEADERS = ['Grupo', 'Categoria', 'Orçamento padrão', 'Cor']

export const CATEGORIAS_WIDTHS = [22, 24, 18, 12]

export const ORCAMENTOS_HEADERS = ['Mês de referência', 'Grupo', 'Categoria', 'Valor']

export const ORCAMENTOS_WIDTHS = [18, 22, 24, 14]

function categoriaRow(groupName: string, category: CategoryRow): Row {
  return [
    textCell(groupName),
    textCell(category.name),
    category.defaultBudget != null ? moneyCell(toAmount(category.defaultBudget)) : textCell(null),
    textCell(category.color),
  ]
}

export function buildCategoriasRows(groups: GroupRow[]): SheetData {
  const rows: Row[] = []
  for (const group of groups) {
    for (const category of group.categories) {
      rows.push(categoriaRow(group.name, category))
    }
  }
  return [headerRow(CATEGORIAS_HEADERS), ...rows]
}

function orcamentoRow(override: BudgetOverrideRow): Row {
  return [
    textCell(override.referenceMonth),
    textCell(override.groupName),
    textCell(override.categoryName),
    moneyCell(override.amount),
  ]
}

export function buildOrcamentosRows(overrides: BudgetOverrideRow[]): SheetData {
  return [headerRow(ORCAMENTOS_HEADERS), ...overrides.map(orcamentoRow)]
}
