import { SensitiveAmount } from '@/components/providers/PrivacyMode'

type CategoryAmount = {
  categoryId: string
  categoryName: string
  amount: number
}

export function TripCategoryBreakdown({ categories }: { categories: CategoryAmount[] }) {
  if (categories.length === 0) return null

  const total = categories.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg-surface p-5 shadow-sm">
      {categories.map((c) => {
        const pct = total > 0 ? (c.amount / total) * 100 : 0
        return (
          <div key={c.categoryId} className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-body text-text-primary">
              {c.categoryName}
            </span>
            <span className="shrink-0 text-caption tabular-nums text-text-tertiary">
              {Math.round(pct)}%
            </span>
            <span className="w-24 shrink-0 text-right text-body font-medium tabular-nums">
              <SensitiveAmount value={c.amount} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
