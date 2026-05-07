import { Chip } from '@/components/ui/chip'
import { Field } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import type { CategoryGroup } from './types'

const PALETTE = ['accent', 'positive', 'warning', 'negative'] as const
type Tone = (typeof PALETTE)[number]

const activeCls: Record<Tone, string> = {
  accent: 'border-accent bg-accent-subtle text-accent-text',
  positive: 'border-positive bg-positive-subtle text-positive-text',
  warning: 'border-warning bg-warning-subtle text-warning-text',
  negative: 'border-negative bg-negative-subtle text-negative-text',
}

const inactiveInitialCls: Record<Tone, string> = {
  accent: 'text-accent-text',
  positive: 'text-positive-text',
  warning: 'text-warning-text',
  negative: 'text-negative-text',
}

type Props = {
  categoryGroups: CategoryGroup[]
  categoryId: string
  onCategoryChange: (id: string) => void
  error?: string
  variant: 'grid' | 'select'
}

export function CategoryPicker({
  categoryGroups,
  categoryId,
  onCategoryChange,
  error,
  variant,
}: Props) {
  const allCategories = categoryGroups.flatMap((g) => g.categories)

  return (
    <Field label="Categoria" error={error}>
      {variant === 'grid' ? (
        <div className="grid grid-cols-5 gap-1.5">
          {allCategories.map((cat, idx) => {
            const tone = PALETTE[idx % PALETTE.length]
            const isActive = categoryId === cat.id
            return (
              <Chip
                key={cat.id}
                active={isActive}
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  'h-auto w-full flex-col gap-1 rounded-md p-2',
                  isActive
                    ? activeCls[tone]
                    : 'border-transparent bg-bg-surface text-text-secondary hover:border-transparent hover:bg-bg-subtle'
                )}
              >
                <span
                  className={cn(
                    'text-label font-semibold',
                    isActive ? '' : inactiveInitialCls[tone]
                  )}
                >
                  {cat.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="w-full truncate text-caption leading-tight">{cat.name}</span>
              </Chip>
            )
          })}
        </div>
      ) : (
        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger error={!!error}>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {categoryGroups.map((group) => (
              <SelectGroup key={group.id}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
}
