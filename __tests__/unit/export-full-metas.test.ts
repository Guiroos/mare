import { describe, expect, it } from 'vitest'
import {
  buildContribuicoesRows,
  buildMetasRows,
  CONTRIBUICOES_HEADERS,
  METAS_HEADERS,
} from '@/lib/export/full/metas'
import type { GoalWithProgress } from '@/lib/queries/goals'

function values(row: unknown[]): unknown[] {
  return row.map((cell) => (cell as { value?: unknown }).value)
}

function meta(overrides: Partial<GoalWithProgress> = {}): GoalWithProgress {
  return {
    id: 'm1',
    name: 'Reserva',
    targetAmount: 10000,
    targetDate: '2026-12-31',
    investmentTypeId: null,
    investmentTypeName: null,
    currentBalance: 2500,
    progress: 25,
    projectedCompletionYearMonth: '2027-04',
    contributions: [],
    ...overrides,
  }
}

describe('buildMetasRows', () => {
  it('emite alvo, saldo e progresso arredondado', () => {
    const rows = buildMetasRows([meta()])

    expect(values(rows[0])).toEqual(METAS_HEADERS)
    expect(values(rows[1])).toEqual(['Reserva', 10000, expect.any(Date), '', 2500, 25])
  })

  it('meta sem data alvo emite célula vazia', () => {
    const rows = buildMetasRows([meta({ targetDate: null })])
    expect(values(rows[1])[2]).toBe('')
  })
})

describe('buildContribuicoesRows', () => {
  it('achata as contribuições de todas as metas, repetindo o nome da meta', () => {
    const rows = buildContribuicoesRows([
      meta({
        name: 'Reserva',
        contributions: [
          { id: 'c1', amount: 500, referenceMonth: '2025-01-01', source: 'manual' },
          { id: 'c2', amount: 700, referenceMonth: '2025-02-01', source: 'investment' },
        ],
      }),
      meta({ id: 'm2', name: 'Viagem', contributions: [] }),
    ])

    expect(values(rows[0])).toEqual(CONTRIBUICOES_HEADERS)
    expect(rows).toHaveLength(3)
    expect(values(rows[1])).toEqual(['Reserva', '2025-01-01', 500, 'Manual'])
    expect(values(rows[2])).toEqual(['Reserva', '2025-02-01', 700, 'Investimento'])
  })

  it('nenhuma meta com contribuição produz só o cabeçalho', () => {
    expect(buildContribuicoesRows([meta()])).toHaveLength(1)
  })
})
