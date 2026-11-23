export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return formatCurrency(value)
}

/** Compact chart-axis label: "R$ 500", "R$ 1,5k", "R$ 1,2M" (no cents below 1k). */
export function formatAxisCurrency(value: number): string {
  // Arredonda na precisão exibida antes de escolher a unidade: 999,7 vira "R$ 1k"
  // (não "R$ 1000") e 999.950 vira "R$ 1M" (não "R$ 1.000k").
  const abs = Math.round(Math.abs(value))
  const sign = value < 0 && abs > 0 ? '-' : ''
  const fmt = (n: number, unit: string) =>
    `${sign}R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit}`
  if (Math.round(abs / 100) >= 10_000) return fmt(abs / 1_000_000, 'M')
  if (abs >= 1_000) return fmt(abs / 1_000, 'k')
  return `${sign}R$ ${abs}`
}

/** Converts a Drizzle decimal field (returned as string) to number.
 *  Centralizes the conversion — swap to a decimal lib here if precision becomes a concern. */
export function toAmount(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}
