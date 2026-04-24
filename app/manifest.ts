import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Maré',
    short_name: 'Maré',
    description: 'Controle financeiro pessoal',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a78c4',
    orientation: 'portrait',
    icons: [
      { src: '/icon/sm', sizes: '32x32', type: 'image/png' },
      { src: '/icon/md', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/lg', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
