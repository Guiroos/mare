/** Marca de ondas do Maré. Cor via `currentColor` — o chamador define com `text-*`. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 42 30" fill="none" aria-hidden className={className}>
      <path
        d="M3 18 C8 10, 14 6, 21 14 C28 22, 34 18, 39 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M3 25 C9 18, 15 15, 21 19 C27 23, 33 22, 39 16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}
