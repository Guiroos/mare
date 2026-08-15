import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/utils/site'

/**
 * Só rotas públicas. Nada sob (app) entra aqui — sitemap é uma declaração de
 * "quero isto indexado", então listar rota autenticada contradiz o robots.ts.
 *
 * Ao subir o blog, acrescentar aqui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/seguranca`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
