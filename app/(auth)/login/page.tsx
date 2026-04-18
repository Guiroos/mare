import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginButton } from '@/components/auth/LoginButton';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, oklch(94% 0.04 225) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, oklch(95% 0.035 210) 0%, transparent 55%), var(--bg-base)',
      }}
    >
      {/* Background tide waves — full screen */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
        <svg
          viewBox="0 0 500 200"
          className="absolute w-[180%] -left-[40%] -bottom-[5%]"
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
      <div className="w-full max-w-[390px] min-h-screen sm:min-h-[780px] flex flex-col justify-between relative overflow-hidden px-7 py-12">
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
        <div className="flex flex-col items-center pt-16 relative z-10">
          {/* Logo mark */}
          <div
            className="w-20 h-20 rounded-[22px] flex items-center justify-center mb-7 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, var(--accent) 0%, oklch(45% 0.12 210) 100%)',
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
            <svg
              width="42"
              height="30"
              viewBox="0 0 42 30"
              fill="none"
              className="relative z-10"
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
          </div>

          {/* Wordmark */}
          <h1
            className="text-[38px] font-semibold leading-none"
            style={{ letterSpacing: '-0.04em', color: 'var(--text-primary)' }}
          >
            Mar
            <span
              className="italic font-medium"
              style={{ color: 'var(--accent)' }}
            >
              é
            </span>
          </h1>
          <p
            className="text-[15px] mt-3.5 text-center max-w-[240px] leading-snug text-pretty"
            style={{ color: 'var(--text-secondary)' }}
          >
            Controle suas finanças
            <br />
            no ritmo das suas marés.
          </p>

          {/* Value props */}
          <div className="mt-9 flex flex-col gap-3.5 w-full">
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
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
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
        <div className="flex flex-col gap-4 relative z-10">
          <LoginButton />
          <p
            className="text-[11px] text-center leading-[1.55] max-w-[280px] mx-auto text-pretty"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Aplicação de uso pessoal · Acesso restrito ao proprietário cadastrado.
          </p>
        </div>
      </div>
    </div>
  );
}
