export type SplitMode = 'igual' | 'custom'

export type SplitEntry = {
  uid: string
  personId: string
  amountCents: number
}

/**
 * Parte de cada pessoa numa divisão igual. Você conta como uma parte a mais,
 * então o total é dividido por `count + 1`.
 *
 * O arredondamento é para baixo de propósito: o resto de centavos fica com
 * você, nunca é cobrado de quem entrou na divisão.
 */
export function computeEqualShare(totalCents: number, count: number): number {
  if (count === 0) return 0
  return Math.floor(totalCents / (count + 1))
}

/**
 * Valores efetivos de cada parte.
 *
 * Em `'igual'`, o `amountCents` guardado é ignorado e a parte é recalculada
 * sobre o total atual — é o que mantém a divisão correta quando o valor da
 * transação muda depois de a divisão ter sido montada. Em `'custom'`, os
 * valores digitados passam intactos.
 */
export function resolveSplitAmounts(
  entries: SplitEntry[],
  totalCents: number,
  mode: SplitMode
): SplitEntry[] {
  if (mode === 'custom') return entries
  const equalShare = computeEqualShare(totalCents, entries.length)
  return entries.map((e) => ({ ...e, amountCents: equalShare }))
}

/**
 * Linhas que de fato viram cobrança em Devedores: precisam ter pessoa
 * selecionada e valor positivo.
 *
 * Existe como função porque o painel de divisão e o submit precisam somar o
 * *mesmo* conjunto — duplicar o predicado inline já produziu divergência entre
 * o "Sua parte" exibido e o valor registrado.
 */
export function selectSubmittableSplits(entries: SplitEntry[]): SplitEntry[] {
  return entries.filter((e) => e.personId && e.amountCents > 0)
}
