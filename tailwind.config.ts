import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* shadcn/ui tokens */
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
          text: 'var(--accent-text)',
          foreground: 'var(--text-inverse)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },

        /* Maré Design System tokens */
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          subtle: 'var(--bg-subtle)',
          muted: 'var(--bg-muted)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
        },
        positive: {
          DEFAULT: 'var(--positive)',
          hover: 'var(--positive-hover)',
          subtle: 'var(--positive-subtle)',
          text: 'var(--positive-text)',
        },
        negative: {
          DEFAULT: 'var(--negative)',
          hover: 'var(--negative-hover)',
          subtle: 'var(--negative-subtle)',
          text: 'var(--negative-text)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
          text: 'var(--warning-text)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontSize: {
        display: ['36px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
        h1: ['28px', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '600' }],
        h2: ['22px', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '600' }],
        h3: ['17px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '1.55' }],
        body: ['14px', { lineHeight: '1.55' }],
        small: ['13px', { lineHeight: '1.4' }],
        caption: ['12px', { lineHeight: '1.4' }],
        label: ['11px', { lineHeight: '1.2', letterSpacing: '0.06em', fontWeight: '600' }],
        amount: ['28px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
        hero: ['40px', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '600' }],
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
      },
      letterSpacing: {
        tight: '-0.02em',
        tighter: '-0.03em',
        tightest: '-0.04em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
