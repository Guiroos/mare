import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'Maré — controle financeiro pessoal com parcelas e metas'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Imagem de compartilhamento (WhatsApp, Telegram, LinkedIn, X).
 *
 * Duas restrições do Satori, o renderer por trás do `ImageResponse`, moldam
 * este arquivo:
 *
 * 1. `oklch()` não é suportado — os tokens do DS entram como hex convertido.
 *    Os valores abaixo saíram da conversão exata dos tokens de `globals.css`,
 *    não de estimativa visual.
 * 2. Não há acesso ao `next/font`. As fontes vêm de `app/_og-fonts/`,
 *    subsetadas com os glifos deste arquivo (14 KB cada em vez de ~90 KB).
 *    Ao mudar qualquer texto daqui, re-subsetar — glifo ausente some da imagem
 *    em silêncio, sem erro de build.
 */

// Tokens do DS convertidos de OKLCH para sRGB
const C = {
  bgBase: '#f0f7fa',
  bgSurface: '#fbfeff',
  textPrimary: '#040f15',
  textSecondary: '#536066',
  accent: '#006fa3',
  accentText: '#004b75',
  positive: '#008666',
  negative: '#ad4a4e',
  border: '#d6e0e4',
}

/* Mesma curva do hero, redesenhada para a proporção 1200×630. A assinatura da
   marca precisa ser reconhecível no preview antes de o usuário abrir o link. */
const CURVE_W = 1200
const CURVE_H = 200
const POINTS = [1240, 2100, -480, 860, 3200, 1750, -1100, 640, 2480, 3960, 2210, 4380]
const MAX = 4800

const px = (i: number) => (i * CURVE_W) / (POINTS.length - 1)
const py = (v: number) => CURVE_H / 2 - (v / MAX) * (CURVE_H / 2)

function curvePath(closed: boolean) {
  let d = `M${px(0)} ${py(POINTS[0])}`
  for (let i = 0; i < POINTS.length - 1; i++) {
    const cx = (px(i) + px(i + 1)) / 2
    d += ` C${cx} ${py(POINTS[i])} ${cx} ${py(POINTS[i + 1])} ${px(i + 1)} ${py(POINTS[i + 1])}`
  }
  /* Fecha na linha do zero, não na base do SVG: fechar embaixo faria a área
     negativa pintar toda a faixa inferior, inclusive sob os trechos positivos. */
  if (closed) d += ` L${px(POINTS.length - 1)} ${py(0)} L0 ${py(0)} Z`
  return d
}

export default async function OpenGraphImage() {
  /* `fetch(new URL(..., import.meta.url))` — o padrão da documentação — falha
     no build com "not implemented... yet...": o runtime não resolve fetch de
     URL `file:`. Leitura direta de disco funciona porque esta rota é
     pré-renderizada no build, com o repo inteiro presente. */
  const fontDir = join(process.cwd(), 'app', '_og-fonts')
  const [regular, semibold] = await Promise.all([
    readFile(join(fontDir, 'Archivo-400.ttf')),
    readFile(join(fontDir, 'Archivo-600.ttf')),
  ])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: C.bgBase,
        fontFamily: 'Archivo',
        padding: '72px 80px 0',
        position: 'relative',
      }}
    >
      {/* Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="46" height="46" viewBox="0 0 22 22">
          <path
            d="M1 14c3.3 0 3.3-6 6.6-6s3.3 6 6.6 6 3.3-6 6.6-6"
            fill="none"
            stroke={C.positive}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M1 19c3.3 0 3.3-6 6.6-6s3.3 6 6.6 6 3.3-6 6.6-6"
            fill="none"
            stroke={C.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
        <span style={{ fontSize: 40, fontWeight: 600, color: C.textPrimary, letterSpacing: -1 }}>
          Maré
        </span>
      </div>

      {/* Headline */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: -2.6,
            lineHeight: 1.08,
            color: C.textPrimary,
            maxWidth: 900,
          }}
        >
          Suas finanças têm ritmo.
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.26em',
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: -2.6,
            lineHeight: 1.08,
            color: C.textPrimary,
            maxWidth: 900,
          }}
        >
          {/* O espaço vem como U+00A0 dentro do próprio texto. `gap` e
              `marginRight` entre spans são ignorados pelo Satori aqui, e um
              espaço comum no fim de um span é aparado — o nbsp sobrevive aos
              dois. Ele está no subset da fonte; se sair de lá, some sem erro. */}
          <span>{'Sua '}</span>
          <span style={{ color: C.accentText, fontWeight: 400 }}>{'planilha '}</span>
          <span>não acompanha.</span>
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 27, color: C.textSecondary }}>
          meumare.com.br
        </div>
      </div>

      {/* Curva de maré rente à base */}
      <div style={{ display: 'flex', margin: '0 -80px' }}>
        <svg width={CURVE_W} height={CURVE_H} viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}>
          <defs>
            <clipPath id="og-above">
              <rect x="0" y="0" width={CURVE_W} height={py(0)} />
            </clipPath>
            <clipPath id="og-below">
              <rect x="0" y={py(0)} width={CURVE_W} height={CURVE_H - py(0)} />
            </clipPath>
          </defs>
          <line x1="0" x2={CURVE_W} y1={py(0)} y2={py(0)} stroke={C.border} strokeWidth="1.5" />
          <path
            d={curvePath(true)}
            fill={C.positive}
            fillOpacity="0.13"
            clipPath="url(#og-above)"
          />
          <path
            d={curvePath(true)}
            fill={C.negative}
            fillOpacity="0.13"
            clipPath="url(#og-below)"
          />
          <path
            d={curvePath(false)}
            fill="none"
            stroke={C.positive}
            strokeWidth="4"
            strokeLinecap="round"
            clipPath="url(#og-above)"
          />
          <path
            d={curvePath(false)}
            fill="none"
            stroke={C.negative}
            strokeWidth="4"
            strokeLinecap="round"
            clipPath="url(#og-below)"
          />
        </svg>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Archivo', data: regular, weight: 400, style: 'normal' },
        { name: 'Archivo', data: semibold, weight: 600, style: 'normal' },
      ],
    }
  )
}
