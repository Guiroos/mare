import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Maré — controle financeiro pessoal',
    short_name: 'Maré',
    /* Mesma promessa da landing, encurtada: é o texto que aparece na loja de
       PWA e no diálogo de instalação. */
    description:
      'Controle financeiro pessoal com parcelas do cartão por fatura, metas e histórico que não zera na virada do ano.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#006fa3',
    orientation: 'portrait',
    lang: 'pt-BR',
    /* `/icons/*` e não `/icon/*`: os ícones grandes saíram de `app/icon.tsx`
       para não virarem `<link rel="icon">` no HTML da landing. Ver o comentário
       lá. */
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      /* Entrada própria, e não `purpose: 'any maskable'` no 512 acima: o
         desenho é outro (fundo sangrando, onda na área segura de 80%).
         Declarar `maskable` sobre o ícone de cantos arredondados fazia o
         Android recortar as pontas da onda e revelar transparência nos
         cantos. */
      { src: '/icons/maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
