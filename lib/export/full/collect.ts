// lib/export/full/collect.ts
import type { SheetData } from 'write-excel-file/node'
import { getAllDebtorEntries, getPeopleWithBalances } from '@/lib/queries/debtors'
import {
  getAllBudgetOverrides,
  getCategoriesWithGroups,
  getPaymentAccounts,
} from '@/lib/queries/categories'
import { getGoalsWithProgress } from '@/lib/queries/goals'
import { collectHistoricoItems, getEarliestActivityDate } from '@/lib/queries/historico'
import {
  getAllInvestmentEntries,
  getAllInvestmentWithdrawals,
  getInvestmentTypes,
} from '@/lib/queries/investments'
import { getAllInstallmentGroups } from '@/lib/queries/parcelas'
import { todayISOString } from '@/lib/utils/date'
import { ALL_TIPOS } from '@/lib/utils/historico-params'
import { buildExtratoRows } from '../extrato-xlsx'
import { buildLancamentosRows, buildSaldosRows } from '../devedores-xlsx'
import { buildContasRows, CONTAS_WIDTHS } from './contas'
import {
  buildCategoriasRows,
  buildOrcamentosRows,
  CATEGORIAS_WIDTHS,
  ORCAMENTOS_WIDTHS,
} from './categorias'
import { buildParcelasRows, PARCELAS_WIDTHS } from './parcelas'
import {
  APORTES_WIDTHS,
  buildAportesRows,
  buildResgatesRows,
  buildTiposRows,
  RESGATES_WIDTHS,
  TIPOS_WIDTHS,
} from './investimentos'
import { buildContribuicoesRows, buildMetasRows, CONTRIBUICOES_WIDTHS, METAS_WIDTHS } from './metas'

export interface ExportSheet {
  name: string
  filename: string
  data: SheetData
  widths: number[]
}

const EXTRATO_WIDTHS = [12, 16, 40, 14, 20, 18, 10, 20]
const SALDOS_WIDTHS = [24, 26, 16, 14, 16]
const LANCAMENTOS_WIDTHS = [24, 12, 14, 40, 14, 18, 14, 30]

/**
 * Coleta a conta inteira. Sem teto de linhas, ao contrário de /extrato e
 * /devedores: ali o usuário pode estreitar o recorte e tentar de novo, aqui não
 * existe filtro nenhum — recusar deixaria sem saída justamente quem tem mais
 * dados. A ausência do EXPORT_ROW_LIMIT é deliberada; não "consertar".
 */
export async function collectFullExport(userId: string): Promise<ExportSheet[]> {
  const hoje = todayISOString()
  const earliest = await getEarliestActivityDate(userId)

  const [
    items,
    accounts,
    groups,
    overrides,
    installments,
    types,
    entries,
    withdrawals,
    goals,
    people,
    debtorEntries,
  ] = await Promise.all([
    collectHistoricoItems(userId, {
      de: earliest ?? hoje,
      ate: hoje,
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    }),
    getPaymentAccounts(userId),
    getCategoriesWithGroups(userId),
    getAllBudgetOverrides(userId),
    getAllInstallmentGroups(userId),
    getInvestmentTypes(userId),
    getAllInvestmentEntries(userId),
    getAllInvestmentWithdrawals(userId),
    getGoalsWithProgress(userId),
    getPeopleWithBalances(userId),
    getAllDebtorEntries(userId),
  ])

  return [
    {
      name: 'Extrato',
      filename: '01-extrato',
      data: buildExtratoRows(items),
      widths: EXTRATO_WIDTHS,
    },
    {
      name: 'Contas',
      filename: '02-contas',
      data: buildContasRows(accounts),
      widths: CONTAS_WIDTHS,
    },
    {
      name: 'Categorias',
      filename: '03-categorias',
      data: buildCategoriasRows(groups),
      widths: CATEGORIAS_WIDTHS,
    },
    {
      name: 'Orçamentos mensais',
      filename: '04-orcamentos-mensais',
      data: buildOrcamentosRows(overrides),
      widths: ORCAMENTOS_WIDTHS,
    },
    {
      name: 'Parcelas',
      filename: '05-parcelas',
      data: buildParcelasRows(installments),
      widths: PARCELAS_WIDTHS,
    },
    {
      name: 'Investimentos — Tipos',
      filename: '06-investimentos-tipos',
      data: buildTiposRows(types),
      widths: TIPOS_WIDTHS,
    },
    {
      name: 'Investimentos — Aportes',
      filename: '07-investimentos-aportes',
      data: buildAportesRows(entries),
      widths: APORTES_WIDTHS,
    },
    {
      name: 'Investimentos — Resgates',
      filename: '08-investimentos-resgates',
      data: buildResgatesRows(withdrawals),
      widths: RESGATES_WIDTHS,
    },
    { name: 'Metas', filename: '09-metas', data: buildMetasRows(goals), widths: METAS_WIDTHS },
    {
      name: 'Metas — Contribuições',
      filename: '10-metas-contribuicoes',
      data: buildContribuicoesRows(goals),
      widths: CONTRIBUICOES_WIDTHS,
    },
    {
      name: 'Devedores — Saldos',
      filename: '11-devedores-saldos',
      data: buildSaldosRows(people),
      widths: SALDOS_WIDTHS,
    },
    {
      name: 'Devedores — Lançamentos',
      filename: '12-devedores-lancamentos',
      data: buildLancamentosRows(debtorEntries),
      widths: LANCAMENTOS_WIDTHS,
    },
  ]
}
