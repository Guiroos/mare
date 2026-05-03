import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginButton } from '@/components/auth/LoginButton'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Brand panel — desktop only (lg+) */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:w-3/5 lg:items-end lg:p-16"
        style={{
          background:
            'linear-gradient(140deg, var(--accent) 0%, oklch(40% 0.13 215) 55%, oklch(30% 0.10 220) 100%)',
        }}
      >
        {/* Decorative waves */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1200 800"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0 520 C200 440, 400 440, 600 500 C800 560, 1000 560, 1200 500 L1200 800 L0 800 Z"
              fill="oklch(100% 0 0 / 0.05)"
            />
            <path
              d="M0 600 C200 540, 400 540, 600 580 C800 620, 1000 620, 1200 580 L1200 800 L0 800 Z"
              fill="oklch(100% 0 0 / 0.07)"
            />
            <path
              d="M0 680 C200 640, 400 640, 600 660 C800 680, 1000 680, 1200 660 L1200 800 L0 800 Z"
              fill="oklch(100% 0 0 / 0.1)"
            />
          </svg>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 20% 30%, oklch(100% 0 0 / 0.08), transparent 45%)',
            }}
          />
        </div>

        {/* Logo — top left */}
        <div className="absolute left-16 top-16 flex items-center gap-3">
          <svg width="28" height="20" viewBox="0 0 42 30" fill="none">
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
          <span className="text-h2 text-white">
            Mar<em className="font-medium not-italic opacity-80">é</em>
          </span>
        </div>

        {/* Headline + subtitle — bottom */}
        <div className="relative z-10 max-w-xl">
          {/* ⚠️ DS token gap: referência usa 64px, DS max é text-hero (40px).
              Para fidelidade ao mockup, considere adicionar text-brand em tailwind.config.ts */}
          <h2 className="text-hero text-white">
            Suas finanças,
            <br />
            em movimento
            <br />
            <em className="font-normal not-italic" style={{ color: 'oklch(88% 0.07 200)' }}>
              constante.
            </em>
          </h2>
          <p
            className="mt-6 max-w-md text-pretty text-body-lg"
            style={{ color: 'oklch(100% 0 0 / 0.7)' }}
          >
            Um espaço calmo e tranquilo pra acompanhar seus gastos e receitas.
          </p>
          <div
            className="mt-10 flex items-center gap-4 text-label uppercase"
            style={{ color: 'oklch(100% 0 0 / 0.6)' }}
          >
            <span>Maré</span>
            <span className="h-px w-16" style={{ background: 'oklch(100% 0 0 / 0.3)' }} />
            <span>v1.0</span>
          </div>
        </div>
      </aside>

      {/* Auth panel — flex-1 always */}
      <main className="flex flex-1 flex-col">
        {/* Mobile layout — full height, current design */}
        <div className="flex flex-1 flex-col justify-between px-7 py-12 lg:hidden">
          {/* Top: logo mark, wordmark, tagline, value props */}
          <div className="flex flex-col items-center pt-16">
            <div
              className="relative mb-7 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl"
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

            <h1 className="text-hero text-text-primary">
              Mar<span className="font-medium italic text-accent">é</span>
            </h1>
            <p className="mt-4 max-w-[240px] text-pretty text-center text-body-lg text-text-secondary">
              Controle suas finanças
              <br />
              no ritmo das suas marés.
            </p>

            <div className="mt-9 flex w-full flex-col gap-4">
              {[
                'Registro rápido em menos de 30s',
                'Histórico permanente, sem virada de ano',
                'Metas com progresso automático',
              ].map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-3 text-small font-medium text-text-secondary"
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
                    style={{ boxShadow: '0 0 0 4px var(--accent-subtle)' }}
                  />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: button + note */}
          <div className="flex flex-col gap-4">
            <LoginButton />
            <p className="mx-auto max-w-[280px] text-pretty text-center text-caption text-text-tertiary">
              Aplicação de uso pessoal · Acesso restrito ao proprietário cadastrado.
            </p>
          </div>
        </div>

        {/* Desktop layout — centered auth form */}
        <div className="hidden flex-1 items-center justify-center p-12 lg:flex">
          <div className="flex w-full max-w-sm flex-col gap-10">
            <div>
              <span className="mb-2 block text-label uppercase text-accent-text">
                Bem-vindo de volta
              </span>
              <h1 className="text-display text-text-primary">Entre na sua conta</h1>
              <p className="mt-3 text-pretty text-body-lg text-text-secondary">
                Use sua conta Google cadastrada para acessar o painel de finanças.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <LoginButton />
              <p className="text-pretty text-center text-caption text-text-tertiary">
                Aplicação de uso pessoal · Acesso restrito ao proprietário cadastrado.
              </p>
            </div>

            <div className="flex justify-between border-t border-border pt-8 text-label text-text-tertiary">
              <span>© 2026 Maré</span>
              <span>v1.0</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
