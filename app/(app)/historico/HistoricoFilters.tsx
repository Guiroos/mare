'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { MultiselectDropdown } from '@/components/ui/multiselect-dropdown'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { buildHistoricoUrl, ALL_TIPOS } from '@/lib/utils/historico-params'
import type { HistoricoParams, TipoKind } from '@/lib/utils/historico-params'
import { cn } from '@/lib/utils/cn'

const TIPO_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida_avulsa', label: 'Avulsa', group: 'Saídas' },
  { value: 'saida_fixa', label: 'Fixa', group: 'Saídas' },
  { value: 'saida_parcelada', label: 'Parcelada', group: 'Saídas' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'resgate', label: 'Resgate' },
]

type CategoryOption = { value: string; label: string }
type AccountOption = { value: string; label: string }

type Props = {
  params: HistoricoParams
  categoryOptions: CategoryOption[]
  accountOptions: AccountOption[]
}

export function HistoricoFilters({ params, categoryOptions, accountOptions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localQ, setLocalQ] = useState(params.q)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const navigate = useCallback(
    (next: Partial<HistoricoParams>) => {
      const url = buildHistoricoUrl({ ...params, ...next, cursor: null })
      startTransition(() => router.push(url))
    },
    [params, router]
  )

  const hasActiveFilters =
    params.tipos.length !== ALL_TIPOS.length ||
    params.categorias.length > 0 ||
    params.contas.length > 0 ||
    params.q !== ''

  const handleSearchChange = (value: string) => {
    setLocalQ(value)
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => navigate({ q: value }), 400)
  }

  return (
    <div className={cn('space-y-2', isPending && 'opacity-60 transition duration-fast')}>
      {/* Linha 1: datas + busca */}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="De">
          <Input
            type="date"
            value={params.de}
            onChange={(e) => navigate({ de: e.target.value })}
            className="w-auto"
          />
        </Field>
        <span className="mb-3 text-text-tertiary">→</span>
        <Field label="Até">
          <Input
            type="date"
            value={params.ate}
            onChange={(e) => navigate({ ate: e.target.value })}
            className="w-auto"
          />
        </Field>
        <Field label="Busca" className="flex-1">
          <Input
            placeholder="Buscar por descrição..."
            value={localQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="min-w-40"
          />
        </Field>
      </div>

      {/* Linha 2: filtros de tipo, categoria, conta */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiselectDropdown
          label="Tipo"
          options={TIPO_OPTIONS}
          selected={params.tipos}
          onChange={(next) => navigate({ tipos: next as TipoKind[] })}
        />
        {categoryOptions.length > 0 && (
          <MultiselectDropdown
            label="Categoria"
            options={categoryOptions}
            selected={params.categorias}
            onChange={(next) => navigate({ categorias: next })}
          />
        )}
        {accountOptions.length > 0 && (
          <MultiselectDropdown
            label="Conta"
            options={accountOptions}
            selected={params.contas}
            onChange={(next) => navigate({ contas: next })}
          />
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              navigate({
                tipos: [...ALL_TIPOS],
                categorias: [],
                contas: [],
                q: '',
              })
            }
            className="ml-auto gap-1 text-negative hover:bg-transparent hover:opacity-80"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
