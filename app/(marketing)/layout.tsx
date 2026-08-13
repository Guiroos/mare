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
 * `SpeedInsights` fica neste grupo, e não no root: o evento enviado carrega a
 * URL concreta (`BeforeSendEvent.url`, campo distinto do `route` com o padrão
 * da rota), e `/e/<token>` tem a credencial no path. A landing é a única rota
 * cujo Core Web Vitals de usuário real é ranqueado, então é aqui que medir
 * importa.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light min-h-screen bg-bg-base font-display text-mkt-body tabular-nums text-text-primary antialiased [color-scheme:light]">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
      <SpeedInsights />
    </div>
  )
}
