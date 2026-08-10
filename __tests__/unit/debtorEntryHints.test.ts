import { describe, it, expect } from 'vitest'
import { amountHints } from '@/lib/utils/debtorEntryHints'

const ENTRADA = 'A entrada vinculada no fluxo de caixa será atualizada com o mesmo valor.'
const QUITADA = 'Cobrança já quitada — alterar o valor altera o saldo da pessoa.'
const VINCULADO =
  'Pagamento vinculado a cobranças quitadas — alterar o valor altera o saldo da pessoa.'

const base = { incomeId: null, status: null, settledCharges: [] }

describe('amountHints', () => {
  it('não avisa nada em cobrança em aberto sem vínculos', () => {
    expect(amountHints({ ...base, status: 'open' })).toBeUndefined()
  })

  it('avisa sobre a entrada vinculada', () => {
    expect(amountHints({ ...base, incomeId: 'inc-1' })).toBe(ENTRADA)
  })

  it('avisa que cobrança quitada mexe no saldo', () => {
    expect(amountHints({ ...base, status: 'settled' })).toBe(QUITADA)
  })

  it('avisa que pagamento com cobranças quitadas mexe no saldo', () => {
    expect(amountHints({ ...base, settledCharges: [{ id: 'c-1' }] })).toBe(VINCULADO)
  })

  // Regressão: pagamento criado por settleCharge com "registrar entrada" tem os
  // dois campos preenchidos. Um early-return no primeiro if devolveria só ENTRADA
  // e esconderia o aviso de saldo no fluxo principal da tela.
  it('acumula os dois avisos quando há entrada vinculada E cobranças quitadas', () => {
    const hint = amountHints({ ...base, incomeId: 'inc-1', settledCharges: [{ id: 'c-1' }] })

    expect(hint).toBe(`${ENTRADA} ${VINCULADO}`)
  })
})
