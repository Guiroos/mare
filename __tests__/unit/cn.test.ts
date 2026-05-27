import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils/cn'
import {
  deriveBgColor,
  DEFAULT_INVESTMENT_TYPE_COLOR,
  DEFAULT_INVESTMENT_TYPE_BG_COLOR,
} from '@/lib/utils/color'

// ─── cn ──────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('concatenates independent classes', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center')
  })

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('filters falsy values (clsx behavior)', () => {
    expect(cn(false && 'hidden', 'block')).toBe('block')
    expect(cn(undefined, null, 'flex')).toBe('flex')
    expect(cn('', 'gap-4')).toBe('gap-4')
  })

  it('merges conflicting Tailwind classes — last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('merges DS custom font-size tokens — last wins', () => {
    // extendTailwindMerge groups all DS text-* tokens as font-size
    expect(cn('text-body', 'text-display')).toBe('text-display')
    expect(cn('text-display', 'text-body')).toBe('text-body')
    expect(cn('text-h1', 'text-caption')).toBe('text-caption')
    expect(cn('text-caption', 'text-h1')).toBe('text-h1')
  })

  it('DS font-size tokens override built-in text-* utilities', () => {
    expect(cn('text-sm', 'text-body')).toBe('text-body')
    expect(cn('text-body', 'text-sm')).toBe('text-sm')
  })

  it('handles multiple arguments, some with conflicts', () => {
    expect(cn('flex', 'px-2', 'text-body', 'px-4', 'text-caption')).toBe('flex px-4 text-caption')
  })

  it('accepts conditional class objects (clsx behavior)', () => {
    expect(cn({ hidden: false, flex: true })).toBe('flex')
    expect(cn({ hidden: true, flex: false })).toBe('hidden')
  })
})

// ─── deriveBgColor ────────────────────────────────────────────────────────────

describe('deriveBgColor', () => {
  it('returns a hex color string of length 7 starting with #', () => {
    const result = deriveBgColor('#000000')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
    expect(result).toHaveLength(7)
  })

  it('black input produces a light near-white background', () => {
    // mix(0) = Math.round(0 * 0.12 + 255 * 0.88) = Math.round(224.4) = 224 = 0xe0
    expect(deriveBgColor('#000000')).toBe('#e0e0e0')
  })

  it('white input returns white (mixing white with white stays white)', () => {
    // mix(255) = Math.round(255 * 0.12 + 255 * 0.88) = Math.round(255) = 255 = 0xff
    expect(deriveBgColor('#ffffff')).toBe('#ffffff')
  })

  it('calculates correct bg for the default investment color', () => {
    // #1a78c4 → r=26, g=120, b=196
    // mix(26)  = Math.round(26*0.12  + 255*0.88) = Math.round(3.12  + 224.4) = Math.round(227.52) = 228 = 0xe4
    // mix(120) = Math.round(120*0.12 + 255*0.88) = Math.round(14.4  + 224.4) = Math.round(238.8)  = 239 = 0xef
    // mix(196) = Math.round(196*0.12 + 255*0.88) = Math.round(23.52 + 224.4) = Math.round(247.92) = 248 = 0xf8
    expect(deriveBgColor('#1a78c4')).toBe('#e4eff8')
  })

  it('produces a lighter color than the input for any dark color', () => {
    const input = '#1a78c4'
    const result = deriveBgColor(input)
    const inputR = parseInt(input.slice(1, 3), 16)
    const resultR = parseInt(result.slice(1, 3), 16)
    expect(resultR).toBeGreaterThan(inputR)
  })

  it('uses lowercase hex in the output', () => {
    expect(deriveBgColor('#AABBCC')).toMatch(/^#[a-f0-9]{6}$/)
  })
})

describe('DEFAULT_INVESTMENT_TYPE_BG_COLOR', () => {
  it('equals deriveBgColor of DEFAULT_INVESTMENT_TYPE_COLOR', () => {
    expect(DEFAULT_INVESTMENT_TYPE_BG_COLOR).toBe(deriveBgColor(DEFAULT_INVESTMENT_TYPE_COLOR))
  })

  it('is a valid hex color', () => {
    expect(DEFAULT_INVESTMENT_TYPE_BG_COLOR).toMatch(/^#[0-9a-f]{6}$/)
  })
})
