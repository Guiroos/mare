'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { MultiselectDropdown } from '@/components/ui/multiselect-dropdown'
import { Input } from '@/components/ui/input'
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

  let searchTimeout: ReturnType<typeof setTimeout>
  const handleSearchChange = (value: string) => {
    setLocalQ(value)
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => navigate({ q: value }), 400)
  }

  return (
    <div className={cn('space-y-2', isPending && 'opacity-60 transition-opacity')}>
      {/* Linha 1: datas + busca */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-input px-3 py-2">
          <span className="text-caption text-text-tertiary">De</span>
          <input
            type="date"
            value={params.de}
            onChange={(e) => navigate({ de: e.target.value })}
            className="bg-transparent text-small text-text-primary outline-none"
          />
        </div>
        <span className="text-text-tertiary">→</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-input px-3 py-2">
          <span className="text-caption text-text-tertiary">Até</span>
          <input
            type="date"
            value={params.ate}
            onChange={(e) => navigate({ ate: e.target.value })}
            className="bg-transparent text-small text-text-primary outline-none"
          />
        </div>
        <Input
          placeholder="Buscar por descrição..."
          value={localQ}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="min-w-40 flex-1"
        />
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
          <button
            onClick={() =>
              navigate({
                tipos: [...ALL_TIPOS],
                categorias: [],
                contas: [],
                q: '',
              })
            }
            className="ml-auto text-caption text-negative hover:opacity-80"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
