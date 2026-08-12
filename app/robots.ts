import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/utils/site'

/**
 * Rotas do shell autenticado. Não são segredo — o robots.txt é público — mas
 * mantê-las fora do crawl evita gastar orçamento de rastreio em URLs que só
 * devolvem redirect para /login.
 *
 * Defesa em profundidade: `robots.txt` impede o rastreio, não a indexação por
 * link externo. O `noindex` de metadata em (app) é quem garante o resto.
 */
const PRIVATE_PATHS = [
  '/dashboard',
  '/registro',
  '/categorias',
  '/configuracao-mes',
  '/parcelas',
  '/investimentos',
  '/metas',
  '/panorama',
  '/devedores',
  '/historico',
  '/contas',
  '/admin',
  '/login',
  '/api/',
]

export default function robots(): MetadataRoute.Robots {
  /* Preview deploys da Vercel não podem ser indexados: duplicariam a landing
     num domínio *.vercel.app e competiriam com o canônico. */
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
