import { Analytics } from '@vercel/analytics/next'
import { SerwistProvider } from '@serwist/next/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from 'sonner'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RegistrationDialogProvider } from '@/components/providers/RegistrationDialog'
import { PrivacyModeProvider } from '@/components/providers/PrivacyMode'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

/* Defesa em profundidade sobre o robots.txt: ele impede o rastreio, mas não a
   indexação de uma URL descoberta por link externo. O noindex fecha isso. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const isAdmin = !!process.env.ADMIN_EMAIL && session.user?.email === process.env.ADMIN_EMAIL

  /* Os providers de cliente (tema, toasts, barra de progresso) vivem aqui e não
     no root layout: a landing pública não usa nenhum deles e pagava ~100 KB de
     JS por eles em toda visita — é a única rota do site cujo LCP conta para
     ranqueamento. `(auth)/layout.tsx` repete só o ThemeProvider, que /login
     precisa para respeitar a preferência de tema.

     `SpeedInsights` e `Analytics` ficam por grupo, e não no root, porque o
     evento que eles enviam carrega a URL concreta (`BeforeSendEvent.url`,
     campo distinto do `route` com o padrão da rota). Aqui é seguro — os ids no
     path são internos e não abrem nada sem sessão — mas em `(share)` o token
     de `/e/<token>` é a própria credencial, então aquele grupo fica de fora.

     Montar na raiz com `beforeSend` filtrando `/e/*` seria a alternativa, mas
     `beforeSend` é prop de função e não atravessa a fronteira RSC: exigiria um
     Client Component novo só para isso. */
  return (
    <SerwistProvider swUrl="/sw.js">
      <ThemeProvider>
        <NextTopLoader color="var(--accent)" height={2} showSpinner={false} />
        <PrivacyModeProvider>
          <RegistrationDialogProvider>
            <div className="min-h-screen bg-bg-base">
              <Sidebar
                user={{
                  name: session.user?.name,
                  email: session.user?.email,
                  image: session.user?.image,
                }}
                isAdmin={isAdmin}
              />
              <main className="pb-20 lg:pb-0 lg:pl-60">
                <div className="px-4 py-6 lg:px-8 lg:py-7">{children}</div>
              </main>
              <BottomNav userEmail={session.user?.email} />
            </div>
          </RegistrationDialogProvider>
        </PrivacyModeProvider>
        <Toaster richColors position="top-center" />
        <SpeedInsights />
        <Analytics />
      </ThemeProvider>
    </SerwistProvider>
  )
}
