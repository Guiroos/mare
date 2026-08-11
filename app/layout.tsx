import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, DM_Sans, IBM_Plex_Mono } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/utils/cn'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
})

/* Archivo e IBM Plex Mono servem apenas as rotas (marketing). next/font
   self-hospeda ambas: a CSP declara font-src 'self', então o <link> para
   fonts.gstatic.com do protótipo seria bloqueado em produção. */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const SITE_URL = 'https://meumare.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Maré — controle financeiro pessoal com parcelas e metas',
    template: '%s · Maré',
  },
  description:
    'Registre gastos em menos de 30 segundos, acompanhe as parcelas do cartão agrupadas por fatura e veja suas metas evoluírem. Sem conectar conta bancária, sem virada de ano.',
  applicationName: 'Maré',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Maré',
    url: SITE_URL,
    title: 'Maré — controle financeiro pessoal com parcelas e metas',
    description:
      'Controle financeiro para quem cansou da planilha. Parcelas projetadas por fatura, histórico que nunca zera e nenhum acesso à sua conta bancária.',
    /* A imagem vem de app/opengraph-image.tsx (convenção de arquivo do App
       Router). Declarar `images` aqui sobrescreveria a gerada. */
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maré — controle financeiro pessoal com parcelas e metas',
    description:
      'Controle financeiro para quem cansou da planilha. Parcelas projetadas por fatura, histórico que nunca zera e nenhum acesso à sua conta bancária.',
    images: ['/og.png'],
  },
  alternates: { canonical: '/' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Maré',
  },
  /* Preview deploys da Vercel ficam fora do índice; só produção é rastreável. */
  robots:
    process.env.VERCEL_ENV === 'production'
      ? { index: true, follow: true }
      : { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#006fa3',
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(dmSans.variable, archivo.variable, plexMono.variable)}
    >
      <body className="font-sans">
        <ThemeProvider>
          <NextTopLoader color="var(--accent)" height={2} showSpinner={false} />
          {children}
          <Toaster richColors position="top-center" />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
