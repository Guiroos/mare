import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginButton } from '@/components/auth/LoginButton'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, oklch(94% 0.04 225) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, oklch(95% 0.035 210) 0%, transparent 55%), var(--bg-base)',
      }}
    >
      {/* Background tide waves — full screen */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-50">
        <svg
          viewBox="0 0 500 200"
          className="absolute -bottom-[5%] -left-[40%] w-[180%]"
          fill="none"
        >
          <path
            d="M0 120 C80 80, 160 80, 250 110 C340 140, 420 140, 500 110 L500 200 L0 200 Z"
            fill="oklch(50% 0.14 230 / 0.04)"
          />
          <path
            d="M0 140 C80 110, 160 110, 250 135 C340 160, 420 160, 500 135 L500 200 L0 200 Z"
            fill="oklch(50% 0.14 230 / 0.06)"
          />
          <path
            d="M0 165 C80 140, 160 140, 250 160 C340 180, 420 180, 500 160 L500 200 L0 200 Z"
            fill="oklch(50% 0.14 230 / 0.09)"
          />
        </svg>
      </div>

      {/* Content container — capped at mobile width, no visible frame */}
      <div className="relative flex min-h-screen w-full max-w-[390px] flex-col justify-between overflow-hidden px-7 py-12 sm:min-h-[780px]">
        {/* Tide indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: '110px',
            width: '2px',
            height: '60px',
            background: 'linear-gradient(to bottom, transparent, var(--accent) 50%, transparent)',
            opacity: 0.12,
          }}
        />

        {/* Top — Logo + tagline + value props */}
        <div className="relative z-10 flex flex-col items-center pt-16">
          {/* Logo mark */}
          <div
            className="relative mb-7 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px]"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, oklch(45% 0.12 210) 100%)',
              boxShadow:
                '0 12px 32px oklch(50% 0.14 230 / 0.28), inset 0 1px 0 oklch(100% 0 0 / 0.25)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, oklch(100% 0 0 / 0.2), transparent 50%)',
              }}
            />
            <svg width="42" height="30" viewBox="0 0 42 30" fill="none" className="relative z-10">
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
          </div>

          {/* Wordmark */}
          <h1
            className="text-[38px] font-semibold leading-none"
            style={{ letterSpacing: '-0.04em', color: 'var(--text-primary)' }}
          >
            Mar
            <span className="font-medium italic" style={{ color: 'var(--accent)' }}>
              é
            </span>
          </h1>
          <p
            className="mt-3.5 max-w-[240px] text-pretty text-center text-[15px] leading-snug"
            style={{ color: 'var(--text-secondary)' }}
          >
            Controle suas finanças
            <br />
            no ritmo das suas marés.
          </p>

          {/* Value props */}
          <div className="mt-9 flex w-full flex-col gap-3.5">
            {[
              'Registro rápido em menos de 30s',
              'Histórico permanente, sem virada de ano',
              'Metas com progresso automático',
            ].map((text) => (
              <div
                key={text}
                className="flex items-center gap-3 text-[13px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{
                    background: 'var(--accent)',
                    boxShadow: '0 0 0 4px var(--accent-subtle)',
                  }}
                />
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — Button + footer note */}
        <div className="relative z-10 flex flex-col gap-4">
          <LoginButton />
          <p
            className="mx-auto max-w-[280px] text-pretty text-center text-[11px] leading-[1.55]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Aplicação de uso pessoal · Acesso restrito ao proprietário cadastrado.
          </p>
        </div>
      </div>
    </div>
  )
}
