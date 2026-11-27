import type { PrimaryType, SaidaSubType } from '@/components/forms/transaction/types'

export type CashFlowInput = {
  primaryType: PrimaryType
  subType: SaidaSubType
  /** Valor digitado no formulário — o total da compra quando `subType = 'parcelada'` */
  amount: number
  installments: number
  /** Destino do resgate; `''` enquanto o usuário não escolheu */
  destination: string
  excludeFromCashFlow: boolean
  /** Total aportado no tipo de investimento — base do capital de uma rolagem (`'reinvest'`) */
  typeCapital: number
  /** A conta escolhida é cartão sob regime de fatura neste mês (resolvido no servidor) */
  viaFatura: boolean
}

/**
 * Quanto o lançamento move o saldo do mês — a mesma regra de `getDashboardData`
 * (`lib/queries/dashboard.ts`), aplicada ao lançamento que ainda não foi salvo.
 * Positivo entra, negativo sai, `0` não mexe no saldo.
 */
export function cashFlowDelta(input: CashFlowInput): number {
  const amount = Number.isFinite(input.amount) ? input.amount : 0

  switch (input.primaryType) {
    case 'saida': {
      // Compra no cartão em regime de fatura: o saldo se move no pagamento da fatura
      if (input.viaFatura) return 0
      // O mês recebe uma parcela, não o total da compra
      if (input.subType === 'parcelada') {
        return input.installments > 0 ? -(amount / input.installments) : 0
      }
      return -amount
    }
    case 'entrada':
      return amount
    case 'investimento':
      return input.excludeFromCashFlow ? 0 : -amount
    case 'resgate': {
      // 'transfer' não cria entrada
      if (input.destination === 'transfer') return 0
      // Rolagem: a entrada conta `amount − investmentReturnCapital` em totalIncomes
      // (createWithdrawal grava min(amount, capital total) como capital)
      if (input.destination === 'reinvest') {
        return amount - Math.min(amount, input.typeCapital)
      }
      return amount
    }
  }
}
