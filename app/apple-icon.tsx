import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const scale = 180 / 42
  const waveH = 30 * scale

  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 40,
        background: 'linear-gradient(135deg, #1a78c4 0%, #1260a0 100%)',
      }}
    >
      <svg width={42 * scale} height={waveH} viewBox="0 0 42 30" fill="none">
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
    { ...size }
  )
}
