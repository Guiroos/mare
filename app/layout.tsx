import type { Metadata, Viewport } from 'next'
import { Archivo, DM_Sans, IBM_Plex_Mono } from 'next/font/google'
import { cn } from '@/lib/utils/cn'
import { SITE_URL } from '@/lib/utils/site'
import './globals.css'

/* `preload: false` porque o preload do next/font é por documento, não por rota:
   com ele ligado, a landing baixava 38 KB de DM Sans no caminho crítico para
   uma fonte que nenhum elemento dela usa — ela disputava banda justamente com
   o Archivo, que desenha o LCP. O app continua recebendo a fonte, só que
   descoberta pelo CSS em vez de pré-carregada, e o app é `noindex`: LCP lá não
   é ranqueado. */
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  preload: false,
})

/* Archivo e IBM Plex Mono servem apenas as rotas (marketing). next/font
   self-hospeda ambas: a CSP declara font-src 'self', então o <link> para
   fonts.gstatic.com do protótipo seria bloqueado em produção.

   Os pesos são exatamente os que a landing usa, mas o motivo difere por
   família: o Archivo é fonte variável (um woff2 cobre a faixa toda, então o
   array só impede negrito sintetizado — o 700 não aparecia em componente de
   marketing nenhum), enquanto a IBM Plex Mono não tem versão variável e emite
   um woff2 por peso no caminho crítico do LCP. Ao introduzir um `font-bold`,
   declarar o peso aqui; no Plex Mono isso custa ~10 KB. */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-archivo',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

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
    /* Sem `images`: o caminho declarado antes (`/og.png`) não existe no repo —
       nem em public/, nem como rota — e sobrescrevia a imagem boa, deixando o
       card do X apontando para um 404. Omitindo o campo, o Next preenche
       `twitter:image` a partir de `app/opengraph-image.tsx` (verificado no HTML
       do build). */
  },
  /* `alternates.canonical` fica em cada página, não aqui: no root layout ele é
     herdado por todas as rotas e cada uma passa a declarar `/` como canônica —
     o oposto do que o canonical serve para fazer. */
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

/**
 * O root layout é deliberadamente sem providers de cliente. `ThemeProvider`,
 * `Toaster` e `NextTopLoader` vivem em `(app)/layout.tsx` e `(auth)/layout.tsx`
 * — a landing não usa nenhum deles e é a única rota cujo LCP é ranqueado.
 *
 * `SpeedInsights` também não fica aqui: o evento que ele envia carrega a URL
 * concreta (`BeforeSendEvent.url`, distinta do `route` com o padrão), e
 * `/e/<token>` tem a credencial no path. Ele vive em `(marketing)/layout.tsx`,
 * que é a rota cujo Core Web Vitals de usuário real importa.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(dmSans.variable, archivo.variable, plexMono.variable)}
    >
      <body className="font-sans">{children}</body>
    </html>
  )
}
