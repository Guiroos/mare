import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginButton } from '@/components/auth/LoginButton'
import { LogoMark } from '@/components/auth/LogoMark'
import { TideCanvas } from '@/components/auth/TideCanvas'

const TAGLINE = 'Um espaço calmo e tranquilo pra acompanhar seus gastos e receitas.'
const BETA_NOTE =
  'Ao entrar, você concorda em usar o Maré durante o beta, sem garantia de disponibilidade.'

function RegistrationClosedNotice() {
  return (
    <div className="rounded-md border border-negative bg-bg-subtle px-4 py-3 text-center text-small text-negative">
      Novos cadastros estão desativados no momento.
    </div>
  )
}

function Footer() {
  return (
    <div className="flex w-full justify-between border-t border-border pt-6 text-label text-text-tertiary">
      <span>© 2026 Maré</span>
      <span>v1.0</span>
    </div>
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [session, { error }] = await Promise.all([auth(), searchParams])
  if (session) redirect('/dashboard')

  const registrationClosed = error === 'RegistrationClosed'

  return (
    // Camadas: maré (z-0; z-30 no surge e na escotilha) → conteúdo (z-10) → "Abrindo seu painel" (z-40)
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-b from-bg-surface to-bg-base to-70%">
      <TideCanvas />

      {/* Desktop (lg+) — "horizonte": maré na base da viewport */}
      <div className="relative z-10 hidden min-h-screen w-full flex-col px-14 py-10 lg:flex">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-5 w-7 text-accent" />
            <span className="text-h2 text-text-primary">
              Mar<em className="font-medium text-accent">é</em>
            </span>
          </div>
          <span className="text-label text-text-tertiary">v1.0</span>
        </header>

        {/* pb-[30vh] empurra o conteúdo para cima da linha d'água (70–84% da altura);
            sem token viewport-relative no DS */}
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center gap-20 pb-[30vh]">
          <div className="min-w-0 flex-1">
            <h2 className="text-brand text-text-primary">
              Suas finanças,
              <br />
              em movimento
              <br />
              <em className="font-normal not-italic text-accent">constante.</em>
            </h2>
            <p className="mt-6 max-w-md text-pretty text-body-lg text-text-secondary">{TAGLINE}</p>
          </div>

          <div className="flex w-96 flex-shrink-0 flex-col gap-8 rounded-xl border border-border bg-bg-surface p-10 shadow-lg">
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
              {registrationClosed && <RegistrationClosedNotice />}
              <LoginButton />
              <p className="text-pretty text-center text-caption text-text-tertiary">{BETA_NOTE}</p>
            </div>

            <Footer />
          </div>
        </div>
      </div>

      {/* Mobile (< lg) — "janela": maré dentro da escotilha */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-6 py-12 lg:hidden">
        <div className="flex w-full max-w-sm flex-col items-center gap-9 text-center">
          {/* A água é desenhada por cima do wordmark: ele afunda e reaparece */}
          <div
            data-tide-port
            className="relative flex h-64 w-64 items-center justify-center rounded-full bg-bg-surface shadow-lg ring-1 ring-inset ring-border"
          >
            <span className="text-wordmark text-text-primary">
              Mar<span className="font-medium italic text-accent">é</span>
            </span>
          </div>

          <div>
            <h1 className="text-display text-text-primary">
              Suas finanças,
              <br />
              em movimento <em className="font-normal not-italic text-accent">constante.</em>
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-pretty text-body-lg text-text-secondary">
              {TAGLINE}
            </p>
          </div>

          <div className="flex w-full flex-col gap-4">
            {registrationClosed && <RegistrationClosedNotice />}
            <LoginButton />
            <p className="mx-auto max-w-xs text-pretty text-caption text-text-tertiary">
              {BETA_NOTE}
            </p>
          </div>

          <Footer />
        </div>
      </div>
    </div>
  )
}
