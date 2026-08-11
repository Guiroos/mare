import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'

/**
 * Shell público. Sem `auth()`, sem providers de estado — tudo aqui precisa
 * poder ser renderizado estaticamente.
 *
 * `font-display` (Archivo) vale só dentro deste grupo de rotas; o app segue
 * em DM Sans pelo `font-sans` do body.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light min-h-screen bg-bg-base font-display text-mkt-body tabular-nums text-text-primary antialiased [color-scheme:light]">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
