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
