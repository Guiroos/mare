import type { Metadata } from 'next'
import { CloudOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Fallback de navegação do service worker (`app/sw.ts`, issue #101).
 *
 * Precisa ser estaticamente prerenderizada: o `@serwist/next/config` monta o
 * manifest de precache a partir de `.next/server/app/**\/*.html`
 * (`precachePrerendered`, ligado por padrão) e reescreve o caminho para
 * `/~offline`. Rota que dependa de `auth()`, `headers()` ou qualquer API
 * dinâmica não emite HTML no build — some do manifest, e o `fallbacks` do
 * `sw.ts` passa a apontar para uma URL que o SW não tem. O gate de
 * `__tests__/unit/service-worker-registro.test.ts` amarra os dois lados.
 *
 * Fica em `app/`, fora de `(marketing)` e de `(app)`: é servida quando a rede
 * caiu, então não pode depender de nada que os layouts daqueles grupos façam.
 * O root layout não monta `ThemeProvider`, e sem ele o script anti-flash do
 * `next-themes` não roda — daí `theme-light`, o mesmo recurso que a landing
 * usa (§5.2 do backlog de SEO) para fixar a paleta clara sem provider.
 */
export const metadata: Metadata = {
  title: 'Sem conexão',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <div className="theme-light flex min-h-screen items-center justify-center bg-bg-base px-6 [color-scheme:light]">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-bg-subtle">
          <CloudOff className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
        </div>

        <h1 className="text-h2 text-text-primary">Você está sem conexão</h1>

        <p className="mt-3 text-body text-text-secondary">
          O Maré não guarda seus dados financeiros no dispositivo, então não há o que mostrar
          offline. Assim que a internet voltar, é só recarregar.
        </p>

        <Button asChild variant="primary" size="md" className="mt-8">
          <a href="/dashboard">Tentar novamente</a>
        </Button>
      </div>
    </div>
  )
}
