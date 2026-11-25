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

/**
 * Sua parte do gasto, em centavos, **sem clamp**: negativo é estado inválido
 * (partes somam mais que o total) e precisa continuar visível. Soma o mesmo
 * conjunto que o submit (`selectSubmittableSplits`).
 */
export function computeYourShareCents(totalCents: number, entries: SplitEntry[]): number {
  return totalCents - selectSubmittableSplits(entries).reduce((s, e) => s + e.amountCents, 0)
}

/**
 * Motivo pelo qual "Registrar só a minha parte" não pode ser submetido, ou
 * `null`. O valor registrado é derivado (sua parte), não digitado — se for
 * ≤ 0, o schema de valor positivo o rejeitaria num campo que o usuário não
 * consegue corrigir. Sem nenhuma parte submetível o switch não tem efeito.
 */
export function integralSubmitBlockReason(
  totalCents: number,
  entries: SplitEntry[]
): string | null {
  if (selectSubmittableSplits(entries).length === 0) return null
  const share = computeYourShareCents(totalCents, entries)
  if (share > 0) return null
  return share === 0
    ? 'As partes cobrem o gasto inteiro — sua parte é R$ 0,00. Desligue "Registrar só a minha parte" ou reduza alguma parte.'
    : 'As partes somam mais que o valor do gasto. Ajuste os valores.'
}
