import { serwist } from '@serwist/next/config'

// Configurator mode: o wrapper `withSerwistInit` (webpack) não roda sob Turbopack,
// bundler padrão do `next build` no Next.js 16 — ver issue #101. Este arquivo é
// consumido pelo `serwist` CLI depois que `next build` já gerou `.next/`.
export default await serwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
})
