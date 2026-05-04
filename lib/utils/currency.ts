export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** Converts a Drizzle decimal field (returned as string) to number.
 *  Centralizes the conversion — swap to a decimal lib here if precision becomes a concern. */
export function toAmount(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}
