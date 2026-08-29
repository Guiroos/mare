import { describe, it, expect } from 'vitest'
import { computeEqualShare, resolveSplitAmounts } from '@/lib/utils/split'

describe('computeEqualShare', () => {
  it('divide o total entre as pessoas mais você', () => {
    // 2 pessoas + você = 3 partes
    expect(computeEqualShare(9000, 2)).toBe(3000)
    // 1 pessoa + você = 2 partes
    expect(computeEqualShare(9000, 1)).toBe(4500)
  })

  it('arredonda para baixo, deixando o resto de centavos com você', () => {
    // R$ 10,00 entre 2 pessoas + você: 333 cada, 334 sobram
    expect(computeEqualShare(1000, 2)).toBe(333)
    expect(1000 - 333 * 2).toBe(334)
  })

  it('retorna 0 quando não há ninguém na divisão', () => {
    expect(computeEqualShare(9000, 0)).toBe(0)
  })

  it('retorna 0 quando o total ainda não foi preenchido', () => {
    expect(computeEqualShare(0, 3)).toBe(0)
  })
})

describe('resolveSplitAmounts', () => {
  it('recalcula sobre o total atual, ignorando valores calculados sobre um total antigo', () => {
    // Cenário do bug: as partes foram montadas com total de R$ 90 e o usuário
    // depois corrigiu o valor da transação para R$ 60.
    const entries = [
      { uid: 'a', personId: 'p1', amountCents: 3000 },
      { uid: 'b', personId: 'p2', amountCents: 3000 },
    ]
    expect(resolveSplitAmounts(entries, 6000, 'igual')).toEqual([
      { uid: 'a', personId: 'p1', amountCents: 2000 },
      { uid: 'b', personId: 'p2', amountCents: 2000 },
    ])
  })

  it('redistribui ao entrar mais uma pessoa, mesmo com valores desatualizados', () => {
    const entries = [
      { uid: 'a', personId: 'p1', amountCents: 4500 },
      { uid: 'b', personId: 'p2', amountCents: 0 },
    ]
    expect(resolveSplitAmounts(entries, 9000, 'igual').map((e) => e.amountCents)).toEqual([
      3000, 3000,
    ])
  })

  it('preserva os valores digitados em modo custom', () => {
    const entries = [
      { uid: 'a', personId: 'p1', amountCents: 5000 },
      { uid: 'b', personId: 'p2', amountCents: 1000 },
    ]
    expect(resolveSplitAmounts(entries, 9000, 'custom')).toEqual(entries)
  })

  it('preserva uid e personId ao recalcular', () => {
    const [entry] = resolveSplitAmounts(
      [{ uid: 'x', personId: 'p9', amountCents: 0 }],
      5000,
      'igual'
    )
    expect(entry).toEqual({ uid: 'x', personId: 'p9', amountCents: 2500 })
  })

  it('não quebra com lista vazia', () => {
    expect(resolveSplitAmounts([], 5000, 'igual')).toEqual([])
  })

  it('zera as partes quando o total é zero', () => {
    const entries = [
      { uid: 'a', personId: 'p1', amountCents: 3000 },
      { uid: 'b', personId: 'p2', amountCents: 3000 },
    ]
    expect(resolveSplitAmounts(entries, 0, 'igual').map((e) => e.amountCents)).toEqual([0, 0])
  })
})
