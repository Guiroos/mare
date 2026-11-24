// Totais do Panorama Anual. A tabela mensal e os cards "Acumulada" precisam de
// períodos diferentes — a tabela soma a coluna que encabeça (12 meses), os cards
// são YTD (meses já ocorridos, mesmo divisor de média/projeção). Calculá-los aqui,
// com nomes pelo período, impede que uma superfície receba o conjunto da outra
// (issue #125: receita/aporte de 12 meses misturados com despesa YTD).

export type MonthTotals = {
  month: string // YYYY-MM
  totalIncomes: number
  totalExpenses: number
  totalInvested: number
}

export type AnnualTotals = {
  totalIncomes: number
  totalExpenses: number
  totalInvested: number
  balance: number
}

export type AnnualTotalsToDate<T extends MonthTotals = MonthTotals> = AnnualTotals & {
  activeMonths: T[]
  monthsElapsed: number
  monthsWithInvestment: number
}

/** Soma de todos os meses recebidos — é o que o rodapé "Total" da tabela mensal exibe. */
export function annualTotals(months: MonthTotals[]): AnnualTotals {
  const totalIncomes = months.reduce((s, m) => s + m.totalIncomes, 0)
  const totalExpenses = months.reduce((s, m) => s + m.totalExpenses, 0)
  const totalInvested = months.reduce((s, m) => s + m.totalInvested, 0)
  return {
    totalIncomes,
    totalExpenses,
    totalInvested,
    balance: totalIncomes - totalExpenses - totalInvested,
  }
}

/**
 * Soma dos meses já ocorridos (`month <= nowYearMonth`, `YYYY-MM`) — os cards "Acumulada".
 * Filtra por data, nunca por `totalIncomes > 0` (ano só com parcelas não tem receita).
 */
export function annualTotalsToDate<T extends MonthTotals>(
  months: T[],
  nowYearMonth: string
): AnnualTotalsToDate<T> {
  const activeMonths = months.filter((m) => m.month <= nowYearMonth)
  return {
    ...annualTotals(activeMonths),
    activeMonths,
    monthsElapsed: activeMonths.length,
    monthsWithInvestment: activeMonths.filter((m) => m.totalInvested > 0).length,
  }
}
