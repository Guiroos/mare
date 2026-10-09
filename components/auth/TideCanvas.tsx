'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from '@/components/auth/LogoMark'

/**
 * Maré animada do `/login`. Precisa de um container `relative overflow-hidden`
 * de tela cheia como pai.
 *
 * - `lg+` ("horizonte"): a água ocupa a base da viewport, atrás do conteúdo, com
 *   régua de maré na borda direita.
 * - `< lg` ("janela"): a água é desenhada só dentro do elemento `[data-tide-port]`
 *   (a escotilha redonda), por cima dele.
 *
 * Controle pelo `LoginButton`, via eventos de janela — assim a página continua
 * Server Component:
 *   `mare:surge` → a maré sobe e cobre a tela antes do redirect do OAuth
 *   `mare:hover` (`CustomEvent<boolean>`) → a maré sobe um pouco
 *
 * Tudo vive em closures do `useEffect`: nenhum re-render por frame.
 */

const PERIOD_S = 14
const SURGE_MS = 1700
const SURGE_REDUCED_MS = 700

/** Duração da subida da maré — o `LoginButton` espera isso antes de redirecionar. */
export function surgeDurationMs() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? SURGE_REDUCED_MS : SURGE_MS
}

// Cores só do canvas — sem token equivalente no DS (painel decorativo de marca)
const LIGHT = [
  'oklch(88% 0.04 220 / 0.75)',
  'oklch(77% 0.08 224 / 0.6)',
  'oklch(63% 0.12 228 / 0.65)',
  'oklch(50% 0.14 230 / 0.92)',
]
const DARK = [
  'oklch(30% 0.06 228 / 0.6)',
  'oklch(38% 0.09 228 / 0.6)',
  'oklch(46% 0.12 230 / 0.65)',
  'oklch(34% 0.11 232 / 0.92)',
]
const FOAM = [0.9, 0.55, 0.45, 0.4]
const deep = (a: number) => `oklch(34% 0.11 226 / ${a.toFixed(3)})`

type Ripple = { x: number; t0: number }
type Surge = { from: number; to: number; t0: number; dur: number }

export function TideCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [arrived, setArrived] = useState(false)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return

    const port = cv.parentElement?.querySelector<HTMLElement>('[data-tide-port]') ?? null
    const wideQuery = matchMedia('(min-width: 1024px)')
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const sp = reduced ? 0.45 : 1
    const am = reduced ? 0.55 : 1
    const surgeMs = surgeDurationMs()
    const font = getComputedStyle(cv).fontFamily

    const glints = Array.from({ length: 22 }, (_, k) => ({
      a: Math.random(),
      b: Math.random(),
      len: 6 + Math.random() * 12,
      dir: k % 2 ? 1 : -1,
    }))
    const mouse = { x: 0, y: 0, active: false }
    const st = {
      mx: 0,
      bump: 0,
      tilt: 0,
      hover: 0,
      hoverTarget: 0,
      clock: 0.15,
      lastT: 0,
      sCur: 0,
      surge: null as Surge | null,
      ripples: [] as Ripple[],
      raf: 0,
      arriveTimer: 0 as ReturnType<typeof setTimeout> | 0,
    }

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
      mouse.active = mouse.x >= 0 && mouse.x <= r.width && mouse.y >= 0 && mouse.y <= r.height
    }
    const onDown = (e: PointerEvent) => {
      onMove(e)
      if (mouse.active) st.ripples.push({ x: mouse.x, t0: performance.now() / 1000 })
    }
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) mouse.active = false
    }
    const onSurge = () => {
      if (st.surge) return
      st.surge = { from: st.sCur, to: 1, t0: performance.now(), dur: surgeMs }
      st.arriveTimer = setTimeout(() => setArrived(true), surgeMs)
    }
    const onHover = (e: Event) => {
      st.hoverTarget = (e as CustomEvent<boolean>).detail ? 1 : 0
    }
    // Voltar do OAuth pelo botão "voltar" pode restaurar a página do bfcache com
    // a tela coberta; desfaz o surge.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      clearTimeout(st.arriveTimer)
      st.surge = null
      st.sCur = 0
      setArrived(false)
    }

    const tick = (now: number) => {
      st.raf = requestAnimationFrame(tick)
      const t = now / 1000
      const W = cv.clientWidth
      const H = cv.clientHeight
      if (!W || !H) return
      const dpr = Math.min(2, devicePixelRatio || 1)
      if (cv.width !== Math.round(W * dpr)) cv.width = Math.round(W * dpr)
      if (cv.height !== Math.round(H * dpr)) cv.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const wide = wideQuery.matches
      // horizonte: água atrás do conteúdo até o surge; janela: só dentro do círculo, por cima
      const z = wide && !st.surge ? '0' : '30'
      if (cv.style.zIndex !== z) cv.style.zIndex = z
      const dark = document.documentElement.classList.contains('dark')
      const dt = Math.min(0.05, t - (st.lastT || t))
      st.lastT = t
      st.clock += dt / PERIOD_S
      const tp = Math.sin(st.clock * Math.PI * 2)
      st.hover += (st.hoverTarget - st.hover) * 0.04

      if (st.surge) {
        const q = Math.min(1, (now - st.surge.t0) / st.surge.dur)
        const ease = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2
        st.sCur = st.surge.from + (st.surge.to - st.surge.from) * ease
      }
      const s = st.sCur

      let circle: { cx: number; cy: number; r: number } | null = null
      if (!wide) {
        if (!port) return
        const pr = port.getBoundingClientRect()
        const cr = cv.getBoundingClientRect()
        const r = pr.width / 2
        if (!r) return
        circle = { cx: pr.left - cr.left + r, cy: pr.top - cr.top + r, r }
      }

      let x0 = 0
      let x1 = W
      let lvl = circle
        ? circle.cy + circle.r * (0.22 - 0.3 * tp) - st.hover * circle.r * 0.18
        : H * (0.77 - 0.07 * tp) - st.hover * H * 0.04
      const sc = circle ? 0.4 : 0.9
      const gap = circle ? 9 : 20
      const rippleV = circle ? 90 : 240
      if (circle) {
        x0 = circle.cx - circle.r
        x1 = circle.cx + circle.r
      }
      lvl += (-140 - lvl) * s
      x0 *= 1 - s
      x1 += (W - x1) * s
      const cxT = circle ? circle.cx : W / 2

      if (circle) {
        const target = mouse.active
          ? Math.max(-1, Math.min(1, (mouse.x - circle.cx) / (W / 2))) * 0.32
          : 0
        st.tilt += (target - st.tilt) * 0.035
      }
      const bumpTarget = !circle && mouse.active ? 28 * Math.exp(-Math.abs(mouse.y - lvl) / 240) : 0
      st.bump += (bumpTarget - st.bump) * 0.05
      st.mx += (mouse.x - st.mx) * 0.08
      st.ripples = st.ripples.filter((r) => t - r.t0 < 5)

      const waveY = (x: number, i: number) => {
        const k = sc * am * (0.65 + 0.15 * i)
        let y =
          lvl +
          i * gap +
          k *
            (9 * Math.sin(x * 0.0055 + t * 0.55 * sp + i * 0.9) +
              5 * Math.sin(x * 0.012 - t * 0.8 * sp + i * 1.6) +
              2 * Math.sin(x * 0.029 + t * 1.5 * sp + i * 0.7))
        y -= st.tilt * (x - cxT) * (1 - s)
        if (i >= 1 && st.bump > 0.1) {
          const d = x - st.mx
          y -= st.bump * (0.5 + 0.25 * i) * Math.exp(-(d * d) / 24200)
        }
        for (const r of st.ripples) {
          const a = t - r.t0
          const dd = Math.abs(x - r.x) - rippleV * a
          y +=
            11 *
            sc *
            Math.exp(-a * 0.8) *
            Math.sin(dd * 0.05) *
            Math.exp(-(dd * dd) / 16200) *
            (i >= 1 ? 1 : 0.5)
        }
        return y
      }

      // Régua de maré — desenhada antes da água, que a cobre
      if (wide && s < 0.6) {
        const ink = dark ? '255,255,255' : '80,96,110'
        const gx = W - 52
        const yTop = H * 0.52
        const yBot = H * 0.95
        const span = yBot - yTop
        ctx.save()
        ctx.globalAlpha = 1 - s / 0.6
        ctx.strokeStyle = `rgba(${ink},0.35)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(gx + 0.5, yTop)
        ctx.lineTo(gx + 0.5, yBot)
        ctx.stroke()
        ctx.font = `600 11px ${font}`
        ctx.fillStyle = `rgba(${ink},0.6)`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (let k = 0; k <= 30; k++) {
          const y = Math.round(yBot - (k / 30) * span) + 0.5
          const big = k % 10 === 0
          const mid = k % 5 === 0
          ctx.beginPath()
          ctx.moveTo(gx, y)
          ctx.lineTo(gx + (big ? 12 : mid ? 8 : 4), y)
          ctx.stroke()
          if (big) ctx.fillText(String(k / 10), gx + 18, y)
        }
        const meters = Math.max(0, Math.min(3, ((yBot - lvl) / span) * 3))
        const my = Math.round(lvl) + 0.5
        ctx.strokeStyle = `rgba(${ink},0.95)`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(gx - 22, my)
        ctx.lineTo(gx, my)
        ctx.stroke()
        ctx.textAlign = 'right'
        ctx.fillStyle = `rgba(${ink},0.95)`
        ctx.font = `600 13px ${font}`
        ctx.fillText(meters.toFixed(2).replace('.', ',') + ' m', gx - 30, my - 12)
        ctx.restore()
      }

      const pal = dark ? DARK : LIGHT
      ctx.save()
      if (circle) {
        ctx.beginPath()
        ctx.arc(circle.cx, circle.cy, circle.r + (Math.hypot(W, H) - circle.r) * s, 0, Math.PI * 2)
        ctx.clip()
      }
      const step = circle && s < 0.05 ? 4 : 8
      const trace = (i: number) => {
        ctx.beginPath()
        ctx.moveTo(x0, waveY(x0, i))
        for (let x = x0 + step; x < x1 + step; x += step) {
          const xx = Math.min(x, x1)
          ctx.lineTo(xx, waveY(xx, i))
        }
      }
      for (let i = 0; i < 4; i++) {
        trace(i)
        ctx.lineTo(x1, H + 2)
        ctx.lineTo(x0, H + 2)
        ctx.closePath()
        ctx.fillStyle = pal[i]
        ctx.fill()
        trace(i)
        ctx.strokeStyle = `rgba(255,255,255,${FOAM[i]})`
        ctx.lineWidth = 1.25
        ctx.stroke()
      }
      // Camada sólida que garante cobertura total no surge
      if (s > 0.01) {
        trace(1)
        ctx.lineTo(x1, H + 2)
        ctx.lineTo(x0, H + 2)
        ctx.closePath()
        ctx.fillStyle = deep(s * 0.92)
        ctx.fill()
      }

      // Reflexos
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      const span = x1 - x0
      glints.forEach((g, k) => {
        if (circle && s < 0.05 && k > 8) return
        const x = x0 + ((((g.a * span * 3 + t * 16 * sp * g.dir) % span) + span) % span)
        const y = waveY(x, 1 + (k % 3)) + 10 + g.b * (circle ? 30 : 70)
        const a = Math.pow(Math.max(0, Math.sin(t * 1.2 * sp + k * 2.4)), 3) * 0.6
        if (a < 0.02 || y > H) return
        ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(x - g.len / 2, y)
        ctx.lineTo(x + g.len / 2, y)
        ctx.stroke()
      })
      ctx.restore()

      // Reflexo do vidro da escotilha
      if (circle && s < 0.5) {
        const { cx, cy, r } = circle
        ctx.save()
        ctx.globalAlpha = 1 - s * 2
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(cx, cy, r - 14, Math.PI * 1.08, Math.PI * 1.32)
        ctx.stroke()
        ctx.lineWidth = 2
        ctx.globalAlpha *= 0.6
        ctx.beginPath()
        ctx.arc(cx, cy, r - 14, Math.PI * 1.38, Math.PI * 1.44)
        ctx.stroke()
        ctx.restore()
      }
    }

    addEventListener('pointermove', onMove)
    addEventListener('pointerdown', onDown)
    addEventListener('pointerout', onOut)
    addEventListener('mare:surge', onSurge)
    addEventListener('mare:hover', onHover)
    addEventListener('pageshow', onPageShow)
    st.raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(st.raf)
      clearTimeout(st.arriveTimer)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerdown', onDown)
      removeEventListener('pointerout', onOut)
      removeEventListener('mare:surge', onSurge)
      removeEventListener('mare:hover', onHover)
      removeEventListener('pageshow', onPageShow)
    }
  }, [])

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />
      {arrived && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 text-white"
        >
          <LogoMark className="h-10 w-14" />
          <span className="text-h2">Abrindo seu painel</span>
        </div>
      )}
    </>
  )
}
