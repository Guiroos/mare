import nextConfig from 'eslint-config-next/core-web-vitals'
import tsConfig from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/',
      'node_modules/',
      'public/',
      'coverage/',
      '.claude/',
      '.ds-sync/',
      'ds-bundle/',
      '.design-sync/',
    ],
  },
  ...nextConfig,
  ...tsConfig,
  {
    rules: {
      'jsx-a11y/label-has-associated-control': 'error',
    },
  },
]

export default config
