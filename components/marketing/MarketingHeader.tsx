import Link from 'next/link'
import { MarketingButton } from './MarketingButton'

/**
 * Cabeçalho da landing. Estático de propósito: não chama `auth()` para trocar
 * o CTA entre "Criar conta" e "Abrir o Maré", porque isso tornaria a rota
 * dinâmica e tiraria a landing do caminho estático — o alvo de LCP < 2.5s não
 * sobrevive a isso. "Entrar" serve aos dois casos: quem já tem sessão cai
 * direto no dashboard pelo redirect do /login.
 */
export function MarketingHeader() {
  return (
    <header className="bg-bg-base/[.86] sticky top-0 z-20 border-b border-border backdrop-blur-[10px]">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[22px] font-semibold tracking-tighter text-text-primary no-underline"
        >
          <TideMark />
          Maré
        </Link>
        <MarketingButton href="/login">Entrar</MarketingButton>
      </div>
    </header>
  )
}

function TideMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="block">
      <path
        d="M1 14c3.3 0 3.3-6 6.6-6s3.3 6 6.6 6 3.3-6 6.6-6"
        fill="none"
        className="stroke-positive"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M1 19c3.3 0 3.3-6 6.6-6s3.3 6 6.6 6 3.3-6 6.6-6"
        fill="none"
        className="stroke-accent"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".45"
      />
    </svg>
  )
}
