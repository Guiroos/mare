import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Gate de contraste do anel de foco (WCAG 2.2 1.4.11 — issue #52). `--ring-*`
// em app/globals.css é `oklch(L% C H / A)`; convertido para sRGB, composto
// sobre `--bg-surface` pelo alpha, e comparado — precisa alcançar >= 3:1 nos
// dois temas. Um teste que só checasse a presença da string `focus:` no
// componente passaria com esse contraste ainda abaixo do mínimo.

const CSS_PATH = join(process.cwd(), 'app/globals.css')

type Rgb = [number, number, number]

function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const ll = l_ ** 3
  const mm = m_ ** 3
  const ss = s_ ** 3
  return [
    4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  ]
}

function gamma(c: number): number {
  const clamped = Math.min(1, Math.max(0, c))
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function oklchToSrgb255(l: number, c: number, h: number): Rgb {
  const linear = oklchToLinearSrgb(l, c, h)
  return linear.map((v) => Math.round(gamma(v) * 255)) as Rgb
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha))) as Rgb
}

function extractOklch(cssBlock: string, varName: string) {
  const re = new RegExp(
    `--${varName}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*/\\s*([\\d.]+))?\\)`
  )
  const match = cssBlock.match(re)
  if (!match) {
    throw new Error(`Token --${varName} não encontrado (ou não é oklch(...)) no bloco fornecido`)
  }
  const [, l, c, h, a] = match
  return { l: Number(l) / 100, c: Number(c), h: Number(h), a: a === undefined ? 1 : Number(a) }
}

function contrastAgainstSurface(block: string, ringToken: string): number {
  const surface = extractOklch(block, 'bg-surface')
  const ring = extractOklch(block, ringToken)
  const surfaceRgb = oklchToSrgb255(surface.l, surface.c, surface.h)
  const ringRgb = oklchToSrgb255(ring.l, ring.c, ring.h)
  const composited = composite(ringRgb, ring.a, surfaceRgb)
  return contrastRatio(composited, surfaceRgb)
}

const css = readFileSync(CSS_PATH, 'utf-8')
const rootBlock = css.match(/:root\s*\{([^}]*)\}/)?.[1]
const darkBlock = css.match(/\.dark\s*\{([^}]*)\}/)?.[1]
if (!rootBlock || !darkBlock) {
  throw new Error('Não encontrei os blocos :root/.dark em app/globals.css')
}

describe('anel de foco — contraste WCAG 1.4.11', () => {
  it.each([
    ['claro', rootBlock, 'ring-accent'],
    ['claro', rootBlock, 'ring-negative'],
    ['escuro', darkBlock, 'ring-accent'],
    ['escuro', darkBlock, 'ring-negative'],
  ] as const)('%s: --%s composto sobre --bg-surface atinge >= 3:1', (_theme, block, token) => {
    expect(contrastAgainstSurface(block, token)).toBeGreaterThanOrEqual(3)
  })
})

// O gate acima só cobre o token — sozinho, não pega alguém apagando o
// `focus-visible:` do Button ou reintroduzindo `focus:shadow-none` no
// HeroAmountCard com o CSS intacto. As duas juntas fecham as duas metades
// do bug da issue #52 (ver review no PR #69).
describe('anel de foco — indicador não suprimido nos componentes', () => {
  it('button.tsx devolve indicador de foco no base', () => {
    const btn = readFileSync(join(process.cwd(), 'components/ui/button.tsx'), 'utf-8')
    expect(btn).toMatch(/focus-visible:shadow-\[0_0_0_3px_var\(--ring-accent\)\]/)
  })

  it('HeroAmountCard não suprime o anel herdado do inputBase', () => {
    const hero = readFileSync(
      join(process.cwd(), 'components/forms/transaction/HeroAmountCard.tsx'),
      'utf-8'
    )
    expect(hero).not.toMatch(/focus:shadow-none/)
  })
})
