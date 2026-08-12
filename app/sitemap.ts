import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/utils/site'

/**
 * Só rotas públicas. Nada sob (app) entra aqui — sitemap é uma declaração de
 * "quero isto indexado", então listar rota autenticada contradiz o robots.ts.
 *
 * Ao subir /privacidade, /termos, /seguranca e o blog, acrescentar aqui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
