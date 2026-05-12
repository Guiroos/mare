import { formatCurrency } from '@/lib/utils/currency'

type Props = {
  total: number
  totalAporte: number
  totalYield: number
  delta: number | null
  deltaPercent: number | null
  prevMonthLabel: string | null
  thisMonthAporte: number
  thisMonthYield: number
}

export function PatrimonyHero({
  total,
  totalAporte,
  totalYield,
  delta,
  deltaPercent,
  prevMonthLabel,
  thisMonthAporte,
  thisMonthYield,
}: Props) {
  const aportePercent = total > 0 ? (totalAporte / total) * 100 : 0
  const yieldPercent = total > 0 ? (totalYield / total) * 100 : 0
  const thisMonthNet = thisMonthAporte + thisMonthYield

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-md"
      style={{
        background:
          'linear-gradient(135deg, oklch(20% 0.04 230) 0%, oklch(28% 0.07 220) 50%, oklch(50% 0.14 230) 110%)',
        color: 'white',
      }}
    >
      {/* Decorative wave */}
      <svg
        className="pointer-events-none absolute right-0 top-0 opacity-10"
        width="280"
        height="220"
        viewBox="0 0 280 220"
        fill="none"
        aria-hidden
      >
        <path
          d="M-10 130 C40 80, 90 70, 140 110 C190 150, 230 130, 290 80"
          stroke="white"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M-10 170 C50 130, 100 120, 150 140 C200 160, 240 150, 290 120"
          stroke="white"
          strokeWidth="9"
          strokeLinecap="round"
          opacity=".55"
        />
        <path
          d="M-10 200 C60 175, 110 165, 160 175 C210 185, 250 180, 290 165"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".3"
        />
      </svg>

      <div className="relative grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:gap-5 md:p-6 xl:grid-cols-4 xl:gap-0 xl:px-5 xl:py-6 2xl:px-8 2xl:py-7">
        {/* Total patrimônio */}
        <div className="flex flex-col gap-1.5 xl:pr-5 2xl:pr-8">
          <span className="text-label uppercase opacity-80">Patrimônio total</span>
          <span className="text-hero tabular-nums xl:text-h1 2xl:text-hero">
            {formatCurrency(total)}
          </span>
          {delta !== null && prevMonthLabel && (
            <span className="mt-1 flex flex-col gap-0.5 opacity-80">
              <span
                className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-label font-semibold"
                style={{ background: 'oklch(100% 0 0 / 0.16)' }}
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  style={{ transform: delta < 0 ? 'rotate(180deg)' : undefined }}
                >
                  <polyline points="6 9 12 3 18 9" />
                </svg>
                {delta >= 0 ? '+ ' : '− '}
                {formatCurrency(Math.abs(delta))}
              </span>
              <span className="text-caption">
                vs. {prevMonthLabel}
                {deltaPercent !== null
                  ? ` · ${deltaPercent >= 0 ? '+' : '−'}${Math.abs(deltaPercent).toFixed(1)}%`
                  : ''}
              </span>
            </span>
          )}
        </div>

        {/* Aporte acumulado */}
        <div className="flex flex-col gap-1 xl:justify-center xl:border-l xl:border-white/20 xl:pl-5 2xl:pl-8">
          <span className="text-label uppercase opacity-70">Aporte acumulado</span>
          <span className="whitespace-nowrap text-h2 tabular-nums">
            {formatCurrency(totalAporte)}
          </span>
          <span className="text-caption opacity-70">{aportePercent.toFixed(1)}% do patrimônio</span>
        </div>

        {/* Rendimento acumulado */}
        <div className="flex flex-col gap-1 xl:justify-center xl:border-l xl:border-white/20 xl:pl-5 2xl:pl-8">
          <span className="text-label uppercase opacity-70">Rendimento acumulado</span>
          <span className="whitespace-nowrap text-h2 tabular-nums">
            {formatCurrency(totalYield)}
          </span>
          <span className="text-caption opacity-70">{yieldPercent.toFixed(1)}% do patrimônio</span>
        </div>

        {/* Este mês */}
        <div className="flex flex-col gap-1 xl:justify-center xl:border-l xl:border-white/20 xl:pl-5 2xl:pl-8">
          <span className="text-label uppercase opacity-70">Este mês</span>
          <span className="whitespace-nowrap text-h2 tabular-nums">
            {thisMonthNet > 0 ? `+ ${formatCurrency(thisMonthNet)}` : formatCurrency(0)}
          </span>
          <span className="whitespace-nowrap text-caption opacity-70">
            aporte {formatCurrency(thisMonthAporte)} · rend. {formatCurrency(thisMonthYield)}
          </span>
        </div>
      </div>
    </div>
  )
}
