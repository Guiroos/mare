import { headers } from 'next/headers'
import { SITE_URL } from '@/lib/utils/site'

/**
 * Origin usada em links que o usuário copia para fora do app (ex: extrato
 * compartilhado em `/e/<token>`).
 *
 * Em produção é sempre o domínio canônico: o mesmo deployment também responde
 * em `<projeto>.vercel.app` e em `<projeto>-<hash>.vercel.app`, então derivar
 * do header `host` gerava link com o domínio da Vercel dependendo de por onde
 * o usuário entrou. Link compartilhado sobrevive à troca de deployment; URL de
 * deployment, não.
 *
 * Fora de produção (preview e localhost) o host da requisição é o único que
 * funciona — daí o fallback.
 *
 * Não fica em `site.ts`: importar `next/headers` lá tornaria `robots.ts` e
 * `sitemap.ts` dinâmicos. `SITE_URL` continua sendo a constante canônica.
 */
export async function getRequestOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === 'production') return SITE_URL

  const h = await headers()
  const host = h.get('host')
  if (!host) return SITE_URL
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
