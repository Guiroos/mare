import Link from 'next/link'

const LINKS = [
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/termos', label: 'Termos' },
  { href: '/seguranca', label: 'Segurança' },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border pb-14 pt-11 text-[14px] text-text-tertiary">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-3.5 px-5 sm:px-8 lg:px-10">
        <p>Maré · Feito no Brasil · © 2026</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="no-underline hover:text-text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
