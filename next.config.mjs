import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const isDev = process.env.NODE_ENV === 'development'

// Content-Security-Policy pragmático para Next.js App Router:
// - 'unsafe-inline' em script/style é necessário para a hidratação do Next e o
//   script anti-flash do next-themes; migrar para nonces é evolução futura.
// - 'unsafe-eval' só em dev (HMR do Turbopack/webpack); nunca em produção.
// - next/font self-hospeda as fontes (font-src 'self'); Speed Insights usa
//   same-origin, com fallback em va.vercel-scripts.com.
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  `connect-src 'self' https://va.vercel-scripts.com`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // HSTS só em produção — evita forçar HTTPS em localhost durante o dev.
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains',
        },
      ]),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSerwist(nextConfig)
