import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'

/**
 * Shell público. Sem `auth()`, sem providers de estado — tudo aqui precisa
 * poder ser renderizado estaticamente.
 *
 * `font-display` (Archivo) vale só dentro deste grupo de rotas; o app segue
 * em DM Sans pelo `font-sans` do body.
 *
 * `SpeedInsights` e `Analytics` ficam neste grupo, e não no root: os dois
 * enviam a URL concreta (`BeforeSendEvent.url`, campo distinto do `route` com
 * o padrão da rota), e `/e/<token>` tem a credencial no path. A landing é a
 * única rota cujo Core Web Vitals de usuário real é ranqueado, e é aqui que o
 * funil de aquisição começa — então é aqui que medir importa.
 *
 * O provider do service worker **não** fica aqui, de propósito (issue #101):
 * ele é um Client Component, e a landing é a única rota que paga LCP
 * ranqueado — o §4.2 do `docs/seo-landing-backlog.md` registra o trabalho de
 * tirar daqui todo provider que a página não usa. Registrar o SW na landing
 * também faria cada visitante que nunca cria conta baixar e instalar 34 KB de
 * service worker. O registro vive em `(app)/layout.tsx`, com escopo default
 * `'/'` — que já cobre esta rota —, e isso é coerente com o `manifest.ts`:
 * `start_url` é `/dashboard`, rota autenticada. Há gate em
 * `__tests__/unit/service-worker-registro.test.ts`.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light min-h-screen bg-bg-base font-display text-mkt-body tabular-nums text-text-primary antialiased [color-scheme:light]">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
      <SpeedInsights />
      <Analytics />
    </div>
  )
}
