'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { Progress } from '@/components/ui/progress'

interface Props {
  label: string
  totalIncomes: number
  totalOutflows: number
  balance: number
  /** Dias até o fim do mês; `null` fora do mês corrente. */
  daysLeft: number | null
}

function pct(part: number, whole: number) {
  return Math.round((part / whole) * 100)
}

function availabilityLine(totalIncomes: number, balance: number, daysLeft: number | null) {
  const parts: string[] = []
  if (balance < 0) parts.push('Saídas acima das entradas')
  else if (totalIncomes > 0) parts.push(`${pct(balance, totalIncomes)}% da renda ainda disponível`)
  if (daysLeft !== null) {
    parts.push(
      daysLeft === 0
        ? 'último dia do mês'
        : `falta${daysLeft > 1 ? 'm' : ''} ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`
    )
  }
  return parts.join(' · ')
}

export function BalanceHero({ label, totalIncomes, totalOutflows, balance, daysLeft }: Props) {
  const spentRatio =
    totalIncomes > 0 ? Math.min(totalOutflows / totalIncomes, 1) : totalOutflows > 0 ? 1 : 0
  const line = availabilityLine(totalIncomes, balance, daysLeft)

  return (
    <div
      className="relative flex flex-wrap items-end gap-x-12 gap-y-6 overflow-hidden rounded-xl p-6 text-white shadow-md lg:px-9 lg:py-8"
      // Painel decorativo com texto branco nos dois temas (exceção da Regra 3): o gradiente
      // parte do --accent do tema CLARO (50%), não de var(--accent). No escuro o token sobe
      // para 58% e branco por cima cai abaixo de 4,5:1; --text-inverse (quase preto no
      // escuro) também não serve, porque reprova contra a ponta de 45% do gradiente.
      style={{
        background: 'linear-gradient(135deg, oklch(50% 0.14 230) 0%, oklch(45% 0.12 210) 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 12% 0%, oklch(100% 0 0 / 0.14), transparent 55%)',
        }}
      />

      <div className="relative min-w-0 flex-1 basis-72">
        <p className="text-label text-white/80">{label}</p>
        <p className="mt-2.5 text-display tabular-nums lg:text-hero">
          {balance < 0 && '− '}
          <SensitiveAmount value={Math.abs(balance)} />
        </p>
        {line && <p className="mt-2.5 text-small text-white/85">{line}</p>}
      </div>

      <div className="relative flex min-w-0 flex-1 basis-72 flex-col gap-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-caption text-white/80">
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              Entradas
            </span>
            <p className="mt-1 text-h2 tabular-nums">
              <SensitiveAmount value={totalIncomes} />
            </p>
          </div>
          <div>
            <span className="flex items-center gap-1.5 text-caption text-white/80">
              <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Saídas
            </span>
            <p className="mt-1 text-h2 tabular-nums">
              <SensitiveAmount value={totalOutflows} />
            </p>
          </div>
        </div>

        <div>
          <Progress
            value={spentRatio}
            max={1}
            aria-label="Parte das entradas que já saiu"
            className="h-1.5 bg-white/20"
            indicatorClassName="bg-white duration-base"
          />
          {totalIncomes > 0 && (
            <p className="mt-1.5 text-caption tabular-nums text-white/85">
              {pct(totalOutflows, totalIncomes)}% das entradas já saiu
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
