import { describe, it, expect } from 'vitest'
import { annualTotals, annualTotalsToDate, MonthTotals } from '@/lib/utils/panorama-totals'

function month(m: string, income = 0, expense = 0, invested = 0): MonthTotals {
  return { month: m, totalIncomes: income, totalExpenses: expense, totalInvested: invested }
}

function year(y: number, values: Partial<Record<number, [number, number, number]>>): MonthTotals[] {
  return Array.from({ length: 12 }, (_, i) => {
    const [inc, exp, inv] = values[i + 1] ?? [0, 0, 0]
    return month(`${y}-${String(i + 1).padStart(2, '0')}`, inc, exp, inv)
  })
}

// Mês corrente fixado em 2026-08 (passado como argumento, sem fake timers).
const NOW = '2026-08'

describe('annualTotals — rodapé da tabela soma a coluna que encabeça', () => {
  it('ano futuro: despesas de parcelas jan–jul somam 3.500 e o saldo é -3.500 (era 0)', () => {
    const futuro = year(2027, {
      1: [0, 500, 0],
      2: [0, 500, 0],
      3: [0, 500, 0],
      4: [0, 500, 0],
      5: [0, 500, 0],
      6: [0, 500, 0],
      7: [0, 500, 0],
    })
    const t = annualTotals(futuro)
    expect(t.totalExpenses).toBe(3500)
    expect(t.balance).toBe(-3500)
  })

  it('ano corrente: inclui os 12 meses nas três pernas, inclusive os futuros', () => {
    const t = annualTotals(year(2026, { 1: [8000, 0, 1000], 11: [8000, 0, 0], 9: [0, 4000, 0] }))
    expect(t.totalIncomes).toBe(16000)
    expect(t.totalExpenses).toBe(4000)
    expect(t.totalInvested).toBe(1000)
    expect(t.balance).toBe(11000)
  })
})

describe('annualTotalsToDate — cards são YTD nas três pernas', () => {
  it('receita lançada em novembro não entra no acumulado de agosto', () => {
    const ano = year(2026, {
      1: [8000, 0, 1000],
      2: [8000, 0, 1000],
      3: [8000, 0, 1000],
      4: [8000, 0, 1000],
      5: [8000, 0, 1000],
      6: [8000, 0, 1000],
      7: [8000, 0, 1000],
      8: [8000, 0, 1000],
      11: [8000, 0, 0],
    })
    const t = annualTotalsToDate(ano, NOW)
    expect(t.totalIncomes).toBe(64000)
    expect(t.monthsElapsed).toBe(8)
    expect(t.totalIncomes / t.monthsElapsed).toBe(8000)
  })

  it('gasto fixo já rolado em set–dez continua fora do acumulado (regressão do Bug 1)', () => {
    const ano = year(2026, {
      8: [0, 1000, 0],
      9: [0, 1000, 0],
      10: [0, 1000, 0],
      11: [0, 1000, 0],
      12: [0, 1000, 0],
    })
    expect(annualTotalsToDate(ano, NOW).totalExpenses).toBe(1000)
  })

  it('aporte futuro não entra e não conta no divisor de monthsWithInvestment', () => {
    const ano = year(2026, { 3: [0, 0, 500], 10: [0, 0, 500] })
    const t = annualTotalsToDate(ano, NOW)
    expect(t.totalInvested).toBe(500)
    expect(t.monthsWithInvestment).toBe(1)
  })

  it('ano encerrado: YTD == 12 meses; ano futuro: nenhum mês decorrido', () => {
    const passado = year(2025, { 1: [100, 10, 5], 12: [100, 10, 5] })
    expect(annualTotalsToDate(passado, NOW).balance).toBe(annualTotals(passado).balance)
    const futuro = year(2027, { 1: [0, 500, 0] })
    const t = annualTotalsToDate(futuro, NOW)
    expect(t.monthsElapsed).toBe(0)
    expect(t.totalExpenses).toBe(0)
  })

  it('ano sem receita (só parcelas) ainda conta os meses decorridos', () => {
    const ano = year(2026, { 1: [0, 300, 0] })
    expect(annualTotalsToDate(ano, NOW).monthsElapsed).toBe(8)
  })
})
