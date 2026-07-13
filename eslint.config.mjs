import nextConfig from 'eslint-config-next/core-web-vitals'
import tsConfig from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/', 'node_modules/', 'public/', 'coverage/', '.claude/'] },
  ...nextConfig,
  ...tsConfig,
]

export default config
