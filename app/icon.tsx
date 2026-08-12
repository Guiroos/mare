import { renderIcon } from './_icon/render'

/**
 * Um único tamanho, de propósito.
 *
 * Antes este arquivo declarava três (`sm`, `md`, `lg`) via
 * `generateImageMetadata`, e o Next emite um `<link rel="icon">` por entrada —
 * o Chrome buscava os três em toda visita à landing, 78 KB só de favicon, com
 * `/icon/md` (192×192) ainda repetido porque o manifest apontava para a mesma
 * imagem sem a query de hash do `<link>`.
 *
 * Os tamanhos grandes são do PWA, não do navegador: vivem em `app/icons/[size]`
 * e só são buscados na instalação.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return renderIcon(size.width)
}
