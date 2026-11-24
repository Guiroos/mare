import type { HistoricoFeedItem } from '@/lib/queries/historico'
import { toAmount } from '@/lib/utils/currency'

export function isDebitKind(kind: HistoricoFeedItem['kind']) {
  return kind === 'saida_avulsa' || kind === 'saida_fixa' || kind === 'saida_parcelada'
}

/**
 * Pagamento de fatura fica fora de `saidas`: o gasto já foi contado nas compras
 * do cartão, somar o pagamento junto conta o mesmo dinheiro duas vezes.
 */
export function sumHistoricoItems(items: HistoricoFeedItem[]) {
  let entradas = 0
  let saidas = 0
  let investido = 0

  for (const item of items) {
    const amt = toAmount(item.amount)
    if (item.kind === 'entrada') entradas += amt
    else if (isDebitKind(item.kind)) {
      if (!item.isFaturaPayment) saidas += amt
    } else if (item.kind === 'investimento') investido += amt
  }

  return { entradas, saidas, investido }
}
