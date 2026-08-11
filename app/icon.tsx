import { ImageResponse } from 'next/og'

export function generateImageMetadata() {
  return [
    { contentType: 'image/png', size: { width: 32, height: 32 }, id: 'sm' },
    { contentType: 'image/png', size: { width: 192, height: 192 }, id: 'md' },
    { contentType: 'image/png', size: { width: 512, height: 512 }, id: 'lg' },
  ]
}

export default function Icon({ id }: { id: string }) {
  const dim = id === 'sm' ? 32 : id === 'md' ? 192 : 512
  const radius = id === 'sm' ? 7 : id === 'md' ? 42 : 112

  // Scale wave paths relative to the 32x32 canvas in the sidebar (viewBox 0 0 42 30)
  const scale = dim / 42
  const waveH = 30 * scale
  const padX = (dim - 42 * scale) / 2
  const padY = (dim - waveH) / 2

  return new ImageResponse(
    <div
      style={{
        width: dim,
        height: dim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        /* Conversão exata dos tokens --accent e --accent-hover de globals.css.
           O Satori não entende oklch(), então o hex é obrigatório aqui — mas
           ele precisa vir do token, não de um azul escolhido à parte. */
        background: 'linear-gradient(135deg, #006fa3 0%, #005d90 100%)',
      }}
    >
      <svg
        width={42 * scale}
        height={waveH}
        viewBox="0 0 42 30"
        fill="none"
        style={{ marginLeft: padX, marginTop: padY }}
      >
        <path
          d="M3 18 C8 10, 14 6, 21 14 C28 22, 34 18, 39 8"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M3 25 C9 18, 15 15, 21 19 C27 23, 33 22, 39 16"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </div>,
    { width: dim, height: dim }
  )
}
