export function deriveBgColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mix = (channel: number) => Math.round(channel * 0.12 + 255 * 0.88)
  const toHex = (value: number) => value.toString(16).padStart(2, '0')

  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

export const DEFAULT_INVESTMENT_TYPE_COLOR = '#1a78c4'
export const DEFAULT_INVESTMENT_TYPE_BG_COLOR = deriveBgColor(DEFAULT_INVESTMENT_TYPE_COLOR)
