import { renderIcon } from '../../_icon/render'

/**
 * Ícones do PWA (192 e 512), referenciados só pelo `manifest.webmanifest`.
 *
 * Ficam fora de `app/icon.tsx` porque lá cada tamanho vira um `<link rel="icon">`
 * no HTML e o navegador os baixa em toda visita — 78 KB de favicon na landing.
 * Aqui só são buscados quando o usuário instala o app.
 *
 * `generateStaticParams` + `force-static` pré-renderizam os dois no build: nada
 * de gerar PNG sob demanda em runtime.
 */
export const dynamic = 'force-static'

const SIZES = ['192', '512'] as const

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params

  if (!(SIZES as readonly string[]).includes(size)) {
    return new Response('Not found', { status: 404 })
  }

  return renderIcon(Number(size))
}
