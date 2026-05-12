import { NumericInput } from '@/components/ui/numeric-input'
import { Chip } from '@/components/ui/chip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils/cn'
import type { FormType, PrimaryType, SaidaSubType } from './types'

const SAIDA_SUBTYPES: { value: SaidaSubType; label: string }[] = [
  { value: 'avulsa', label: 'Avulsa' },
  { value: 'fixa', label: 'Fixa' },
  { value: 'parcelada', label: 'Parcelada' },
]

const heroCard: Record<PrimaryType, string> = {
  saida: 'bg-negative-subtle',
  entrada: 'bg-positive-subtle',
  investimento: 'bg-accent-subtle',
  resgate: 'bg-positive-subtle',
}

const heroLabel: Record<PrimaryType, string> = {
  saida: 'text-negative-text',
  entrada: 'text-positive-text',
  investimento: 'text-accent-text',
  resgate: 'text-positive-text',
}

const heroInput: Record<PrimaryType, string> = {
  saida: 'text-negative-text placeholder:text-negative-text placeholder:opacity-50',
  entrada: 'text-positive-text placeholder:text-positive-text placeholder:opacity-50',
  investimento: 'text-accent-text placeholder:text-accent-text placeholder:opacity-50',
  resgate: 'text-positive-text placeholder:text-positive-text placeholder:opacity-50',
}

const primaryTypeLabel: Record<PrimaryType, string> = {
  saida: 'Saída',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

type Props = {
  primaryType: PrimaryType
  resolvedType: FormType
  subType: SaidaSubType
  onSubTypeChange: (v: SaidaSubType) => void
  onValueChange: (cents: number) => void
  errors: Record<string, string>
}

export function HeroAmountCard({
  primaryType,
  resolvedType,
  subType,
  onSubTypeChange,
  onValueChange,
  errors,
}: Props) {
  if (primaryType === 'investimento') {
    return (
      <div className={cn('rounded-lg p-4', heroCard.investimento)}>
        <p
          className={cn(
            'text-label font-semibold uppercase tracking-widest',
            heroLabel.investimento
          )}
        >
          Investimento
        </p>
        <div className="mt-1">
          <p className={cn('text-caption opacity-60', heroLabel.investimento)}>Aporte</p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-h3', heroLabel.investimento)}>R$</span>
            <NumericInput
              name="amount"
              error={!!errors.amount}
              autoFocus
              onValueChange={onValueChange}
              preserveExplicitZero
              className={cn(
                'h-auto border-0 bg-transparent py-1 text-display tabular-nums shadow-none focus:border-transparent focus:shadow-none',
                heroLabel.investimento
              )}
            />
          </div>
        </div>
        <Separator className="my-3" />
        <div>
          <p className={cn('text-caption opacity-60', heroLabel.investimento)}>
            Rendimento líquido
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-body opacity-70', heroLabel.investimento)}>R$</span>
            <NumericInput
              name="yieldAmount"
              error={!!errors.yieldAmount}
              preserveExplicitZero
              className={cn(
                'h-auto border-0 bg-transparent py-1 text-h2 tabular-nums shadow-none focus:border-transparent focus:shadow-none',
                heroLabel.investimento
              )}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1 rounded-lg p-4', heroCard[primaryType])}>
      <p
        className={cn('text-label font-semibold uppercase tracking-widest', heroLabel[primaryType])}
      >
        {primaryTypeLabel[primaryType]}
      </p>
      <div className="flex items-baseline gap-2">
        <span className={cn('text-h3', heroLabel[primaryType])}>R$</span>
        <NumericInput
          name={resolvedType === 'parcelado' ? 'totalAmount' : 'amount'}
          error={!!(errors.amount ?? errors.totalAmount)}
          required
          autoFocus
          onValueChange={onValueChange}
          className={cn(
            'h-auto border-0 bg-transparent py-1 text-display tabular-nums shadow-none focus:border-transparent focus:shadow-none',
            heroInput[primaryType]
          )}
        />
      </div>
      {primaryType === 'saida' && (
        <div className="flex gap-1 pt-1">
          {SAIDA_SUBTYPES.map((st) => (
            <Chip
              key={st.value}
              active={subType === st.value}
              onClick={() => onSubTypeChange(st.value)}
              className={cn(
                'px-2 py-0.5 text-caption',
                subType === st.value
                  ? 'border-negative bg-bg-surface text-negative-text'
                  : 'border-transparent bg-transparent text-negative-text opacity-60 hover:border-transparent hover:opacity-100'
              )}
            >
              {st.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
