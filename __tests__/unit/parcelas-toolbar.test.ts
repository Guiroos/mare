import { describe, it, expect } from 'vitest'
import { applySort } from '@/components/parcelas/ParcelasToolbar'

type Group = Parameters<typeof applySort>[0][number]

const group = (id: string, overrides: Partial<Group> = {}): Group => ({
  id,
  name: `Grupo ${id}`,
  categoryId: 'cat-1',
  accountId: 'acc-1',
  accountName: 'Conta',
  categoryName: 'Categoria',
  startDate: '2026-01-01',
  nextChargeMonth: null,
  nextChargeDate: null,
  totalAmount: 0,
  totalInstallments: 1,
  paidInstallments: 0,
  remainingInstallments: 1,
  installmentAmount: 0,
  remainingAmount: 0,
  ...overrides,
})

describe('applySort', () => {
  it('soonest-end ordena por endYM (data real de término), não por remainingInstallments', () => {
    // A: termina antes (out/26) mas tem mais parcelas restantes que B.
    // B: termina depois (nov/26) mas tem menos parcelas restantes que A — a 1a
    // parcela de B só cai em 2026-10, então "menos parcelas restantes" não significa
    // "termina mais cedo" quando cada grupo parte de um nextChargeMonth diferente.
    const a = group('A', { remainingInstallments: 3, endYM: '2026-10' })
    const b = group('B', { remainingInstallments: 2, endYM: '2026-11' })

    // Ordenar por remainingInstallments (o bug) devolveria [B, A] — B tem menos
    // parcelas restantes (2 < 3) e apareceria primeiro, embora termine depois.
    const sorted = applySort([b, a], 'soonest-end')

    expect(sorted.map((g) => g.id)).toEqual(['A', 'B'])
  })

  it('soonest-end com endYM ausente cai para string vazia (não quebra o sort)', () => {
    const a = group('A', { endYM: undefined })
    const b = group('B', { endYM: '2026-01' })

    const sorted = applySort([b, a], 'soonest-end')

    expect(sorted.map((g) => g.id)).toEqual(['A', 'B'])
  })

  it('expensive ordena por installmentAmount decrescente', () => {
    const a = group('A', { installmentAmount: 50 })
    const b = group('B', { installmentAmount: 100 })

    expect(applySort([a, b], 'expensive').map((g) => g.id)).toEqual(['B', 'A'])
  })

  it('highest-balance ordena por remainingAmount decrescente', () => {
    const a = group('A', { remainingAmount: 200 })
    const b = group('B', { remainingAmount: 500 })

    expect(applySort([a, b], 'highest-balance').map((g) => g.id)).toEqual(['B', 'A'])
  })
})
