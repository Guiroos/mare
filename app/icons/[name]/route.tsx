import { renderIcon } from '../../_icon/render'

/**
 * Ícones do PWA, referenciados só pelo `manifest.webmanifest`.
 *
 * Ficam fora de `app/icon.tsx` porque lá cada tamanho vira um `<link rel="icon">`
 * no HTML e o navegador os baixa em toda visita — 78 KB de favicon na landing.
 * Aqui só são buscados quando o usuário instala o app.
 *
 * `generateStaticParams` + `force-static` pré-renderizam todos no build: nada
 * de gerar PNG sob demanda em runtime.
 *
 * O nome carrega o propósito, não só o tamanho, porque a variante maskable tem
 * desenho diferente do mesmo 512 (ver `renderIcon`) — as duas precisam existir
 * lado a lado no manifest.
 */
export const dynamic = 'force-static'

const ICONS = {
  '192': { dim: 192, maskable: false },
  '512': { dim: 512, maskable: false },
  'maskable-512': { dim: 512, maskable: true },
} as const

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const icon = ICONS[name as keyof typeof ICONS]

  if (!icon) {
    return new Response('Not found', { status: 404 })
  }

  return renderIcon(icon.dim, icon.maskable)
}
