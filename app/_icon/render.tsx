import { ImageResponse } from 'next/og'

/**
 * Renderizador único da marca em PNG, usado pelo favicon (`app/icon.tsx`), pelo
 * ícone iOS (`app/apple-icon.tsx`) e pelos ícones do PWA (`app/icons/[size]`).
 *
 * Pasta com `_` é privada no App Router: não vira rota.
 *
 * Existe porque as três superfícies desenham a mesma onda com o mesmo azul, e
 * antes cada arquivo tinha a sua cópia — o `#1a78c4` que não era a cor da marca
 * sobreviveu justamente assim, corrigido num arquivo e não nos outros.
 */
export function renderIcon(dim: number) {
  /* A onda vem do viewBox 0 0 42 30 do logo da Sidebar. */
  const scale = dim / 42
  const waveW = 42 * scale
  const waveH = 30 * scale

  return new ImageResponse(
    <div
      style={{
        width: dim,
        height: dim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round((dim * 7) / 32),
        /* Conversão exata dos tokens --accent e --accent-hover de globals.css.
             O Satori não entende oklch(), então o hex é obrigatório aqui — mas
             ele precisa vir do token, não de um azul escolhido à parte. */
        background: 'linear-gradient(135deg, #006fa3 0%, #005d90 100%)',
      }}
    >
      {/* Sem margem de centralização: o flex do pai já centra, e a margem que
            o `app/icon.tsx` somava por cima empurrava a onda para baixo — o
            favicon saía descentralizado em relação ao ícone iOS, que nunca teve
            a margem. */}
      <svg width={waveW} height={waveH} viewBox="0 0 42 30" fill="none">
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
