// Tailwind config used ONLY to compile the design-sync stylesheet (`.design-sync/build/ds.css`).
// Extends the repo's real config; widens `content` to include the authored preview files and
// safelists the DS token utilities so the claude.ai/design agent can use the full vocabulary
// documented in `.design-sync/conventions.md`, not just the subset this app happens to use today.
import type { Config } from 'tailwindcss'
import base from '../tailwind.config'

const colorTokens = [
  'bg-base',
  'bg-surface',
  'bg-input',
  'bg-subtle',
  'bg-muted',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-inverse',
  'accent',
  'accent-hover',
  'accent-subtle',
  'accent-text',
  'positive',
  'positive-hover',
  'positive-subtle',
  'positive-text',
  'negative',
  'negative-hover',
  'negative-subtle',
  'negative-text',
  'warning',
  'warning-subtle',
  'warning-text',
  'border',
  'border-strong',
]

const typeTokens = [
  'hero',
  'display',
  'h1',
  'h2',
  'h3',
  'body-lg',
  'body',
  'small',
  'caption',
  'label',
  'amount',
]

const safelist = [
  ...(base.safelist ?? []),
  ...colorTokens.flatMap((t) => [`bg-${t}`, `text-${t}`, `border-${t}`]),
  ...typeTokens.map((t) => `text-${t}`),
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-full',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'duration-fast',
  'duration-base',
  'tabular-nums',
  'p-0.5',
  'p-1.5',
  'p-2.5',
  'gap-0.5',
  'gap-1.5',
  'gap-2.5',
] as Config['safelist']

const config: Config = {
  ...base,
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './.design-sync/previews/**/*.{ts,tsx}',
  ],
  safelist,
}

export default config
