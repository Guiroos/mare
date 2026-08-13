import { headers } from 'next/headers'
import { SITE_URL } from '@/lib/utils/site'

/**
 * Origin of the current request, for links the user copies out of the app.
 * Not in `site.ts`: importing `next/headers` there would make the static
 * `robots.ts` and `sitemap.ts` dynamic. `SITE_URL` stays the canonical constant.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('host')
  if (!host) return SITE_URL
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
