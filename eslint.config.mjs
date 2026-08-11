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
    // Escopado a field.tsx: o `<Label>` do DS não está em `labelComponents` no
    // resto do repo porque vários call sites pré-existentes (fora do escopo da
    // #53) ainda não têm controle associável — ver PR #72. `assert: 'htmlFor'`
    // é necessário porque o default ('either') aceita nesting e não pega a
    // remoção do htmlFor gerado por useId() em field.tsx.
    files: ['components/ui/field.tsx'],
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        { labelComponents: ['Label'], assert: 'htmlFor' },
      ],
    },
  },
]

export default config
