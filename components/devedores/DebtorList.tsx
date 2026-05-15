'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { PersonWithBalance } from '@/lib/queries/debtors'
import { deletePersonIfEmpty } from '@/lib/actions/debtors'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { RowActions } from '@/components/ui/row-actions'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { Eye, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

type Props = {
  people: PersonWithBalance[]
}

export function DebtorList({ people }: Props) {
  const [editTarget, setEditTarget] = useState<PersonWithBalance | null>(null)
  const router = useRouter()

  if (people.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Nenhuma pessoa cadastrada."
        description="Cadastre uma pessoa para começar a registrar cobranças."
      />
    )
  }

  const handleDelete = async (person: PersonWithBalance) => {
    try {
      await deletePersonIfEmpty(person.id)
      toast.success(`${person.name} excluída.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir.'
      toast.error(msg)
    }
  }

  return (
    <>
      <div className="divide-y divide-border overflow-hidden rounded-xl border bg-bg-surface">
        {people.map((person) => (
          <div key={person.id} className="group flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link
                href={`/devedores/${person.id}`}
                className="truncate text-small font-medium text-text-primary hover:text-accent-text"
              >
                {person.name}
              </Link>
              {(person.email || person.lastMovement) && (
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  {person.email && (
                    <span className="truncate text-caption text-text-tertiary">{person.email}</span>
                  )}
                  {person.email && person.lastMovement && (
                    <span className="shrink-0 text-caption text-text-tertiary">·</span>
                  )}
                  {person.lastMovement && (
                    <span className="shrink-0 text-caption text-text-tertiary">
                      {formatDate(person.lastMovement)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span
              className={cn(
                'shrink-0 text-small font-semibold tabular-nums',
                person.balance > 0
                  ? 'text-negative'
                  : person.balance < 0
                    ? 'text-positive'
                    : 'text-text-tertiary'
              )}
            >
              {person.balance === 0 ? (
                <Badge variant="muted">Quitado</Badge>
              ) : (
                formatCurrency(Math.abs(person.balance))
              )}
            </span>
            <RowActions
              onEdit={() => setEditTarget(person)}
              onDelete={person.balance === 0 ? () => handleDelete(person) : undefined}
              additionalActions={[
                {
                  label: 'Visualizar',
                  icon: Eye,
                  onClick: () => router.push(`/devedores/${person.id}`),
                },
              ]}
            />
          </div>
        ))}
      </div>

      {editTarget && (
        <PersonDialog
          mode="edit"
          person={editTarget}
          balance={editTarget.balance}
          open
          onOpenChange={(v) => {
            if (!v) setEditTarget(null)
          }}
        />
      )}
    </>
  )
}
