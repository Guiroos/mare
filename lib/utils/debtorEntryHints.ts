/**
 * Avisos exibidos no campo "Valor" ao editar um lançamento de devedor.
 *
 * As condições NÃO são exclusivas: um pagamento criado por `settleCharge` com
 * "registrar entrada" tem `incomeId` **e** cobranças quitadas apontando para ele
 * (`settledCharges`), que é o fluxo principal da tela. Retornar no primeiro caso
 * apagaria justamente o aviso de que o saldo da pessoa vai mudar.
 */
type AmountHintEntry = {
  incomeId: string | null
  status: string | null
  settledCharges: unknown[]
}

export function amountHints(entry: AmountHintEntry): string | undefined {
  const hints: string[] = []

  if (entry.incomeId) {
    hints.push('A entrada vinculada no fluxo de caixa será atualizada com o mesmo valor.')
  }
  if (entry.status === 'settled') {
    hints.push('Cobrança já quitada — alterar o valor altera o saldo da pessoa.')
  }
  if (entry.settledCharges.length > 0) {
    hints.push(
      'Pagamento vinculado a cobranças quitadas — alterar o valor altera o saldo da pessoa.'
    )
  }

  return hints.length > 0 ? hints.join(' ') : undefined
}
