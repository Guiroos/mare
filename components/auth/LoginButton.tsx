'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { surgeDurationMs } from '@/components/auth/TideCanvas'

const GoogleIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

const setTideHover = (on: boolean) => dispatchEvent(new CustomEvent('mare:hover', { detail: on }))

type Provider = 'google' | 'dev'

export function LoginButton() {
  const [pending, setPending] = useState<Provider | null>(null)

  // Voltar do OAuth pelo bfcache restaura o botão travado em loading
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null)
    }
    addEventListener('pageshow', onPageShow)
    return () => removeEventListener('pageshow', onPageShow)
  }, [])

  // O redirect é rápido demais e cortaria a animação: a maré cobre a tela
  // primeiro, depois o signIn sai (ver TideCanvas)
  const enter = (provider: Provider) => {
    setPending(provider)
    dispatchEvent(new Event('mare:surge'))
    setTimeout(() => signIn(provider, { callbackUrl: '/dashboard' }), surgeDurationMs())
  }

  return (
    <>
      <Button
        variant="surface"
        size="lg"
        className="w-full !gap-3 !rounded-lg"
        leftIcon={<GoogleIcon />}
        loading={pending === 'google'}
        disabled={pending !== null}
        onMouseEnter={() => setTideHover(true)}
        onMouseLeave={() => setTideHover(false)}
        onClick={() => enter('google')}
      >
        Entrar com Google
      </Button>

      {process.env.NODE_ENV === 'development' && (
        <Button
          variant="ghost"
          size="md"
          className="w-full border border-dashed border-border"
          loading={pending === 'dev'}
          disabled={pending !== null}
          onMouseEnter={() => setTideHover(true)}
          onMouseLeave={() => setTideHover(false)}
          onClick={() => enter('dev')}
        >
          Entrar como Dev
        </Button>
      )}
    </>
  )
}
