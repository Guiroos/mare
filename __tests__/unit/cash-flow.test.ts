import { describe, it, expect } from 'vitest'
import { cashFlowDelta, type CashFlowInput } from '@/lib/utils/cash-flow'

const base: CashFlowInput = {
  primaryType: 'saida',
  subType: 'avulsa',
  amount: 0,
  installments: 1,
  destination: '',
  excludeFromCashFlow: false,
  typeCapital: 0,
  viaFatura: false,
}

describe('cashFlowDelta', () => {
  it('saída avulsa sai pelo valor cheio', () => {
    expect(cashFlowDelta({ ...base, amount: 300 })).toBe(-300)
  })

  it('compra parcelada move o saldo por uma parcela, não pelo total', () => {
    expect(cashFlowDelta({ ...base, subType: 'parcelada', amount: 1200, installments: 12 })).toBe(
      -100
    )
  })

  it('compra no cartão sob fatura não move o saldo do mês', () => {
    expect(cashFlowDelta({ ...base, amount: 3000, viaFatura: true })).toBe(0)
    expect(cashFlowDelta({ ...base, amount: 3000, viaFatura: false })).toBe(-3000)
  })

  it('entrada soma o valor cheio', () => {
    expect(cashFlowDelta({ ...base, primaryType: 'entrada', amount: 500 })).toBe(500)
  })

  it('aporte sai do caixa, salvo excludeFromCashFlow', () => {
    expect(cashFlowDelta({ ...base, primaryType: 'investimento', amount: 400 })).toBe(-400)
    expect(
      cashFlowDelta({
        ...base,
        primaryType: 'investimento',
        amount: 400,
        excludeFromCashFlow: true,
      })
    ).toBe(0)
  })

  it('resgate para o caixa entra pelo valor cheio', () => {
    expect(
      cashFlowDelta({
        ...base,
        primaryType: 'resgate',
        amount: 1000,
        destination: 'income',
        typeCapital: 1000,
      })
    ).toBe(1000)
  })

  it('resgate por rolagem com capital suficiente não move o saldo', () => {
    expect(
      cashFlowDelta({
        ...base,
        primaryType: 'resgate',
        amount: 1000,
        destination: 'reinvest',
        typeCapital: 1000,
      })
    ).toBe(0)
  })

  it('resgate por rolagem acima do capital soma só o rendimento', () => {
    expect(
      cashFlowDelta({
        ...base,
        primaryType: 'resgate',
        amount: 1200,
        destination: 'reinvest',
        typeCapital: 1000,
      })
    ).toBe(200)
  })

  it('resgate com destino transfer não cria entrada', () => {
    expect(
      cashFlowDelta({ ...base, primaryType: 'resgate', amount: 500, destination: 'transfer' })
    ).toBe(0)
  })
})
