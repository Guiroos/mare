export const ALL_TIPOS = [
  'saida_avulsa',
  'saida_fixa',
  'saida_parcelada',
  'entrada',
  'investimento',
  'resgate',
] as const

export type TipoKind = (typeof ALL_TIPOS)[number]

export type HistoricoParams = {
  de: string
  ate: string
  tipos: TipoKind[]
  categorias: string[]
  contas: string[]
  q: string
  cursor: string | null
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function ninetyDaysAgoStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

export function parseHistoricoParams(
  searchParams: Record<string, string | string[] | undefined>
): HistoricoParams {
  const raw = (key: string) => {
    const v = searchParams[key]
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
  }

  const tiposRaw = raw('tipos')
  const tipos: TipoKind[] = tiposRaw
    ? (tiposRaw
        .split(',')
        .filter((t) => (ALL_TIPOS as readonly string[]).includes(t)) as TipoKind[])
    : [...ALL_TIPOS]

  const categoriasRaw = raw('categorias')
  const contasRaw = raw('contas')

  return {
    de: raw('de') ?? ninetyDaysAgoStr(),
    ate: raw('ate') ?? todayStr(),
    tipos,
    categorias: categoriasRaw ? categoriasRaw.split(',').filter(Boolean) : [],
    contas: contasRaw ? contasRaw.split(',').filter(Boolean) : [],
    q: raw('q') ?? '',
    cursor: raw('cursor') ?? null,
  }
}

export function buildHistoricoUrl(params: HistoricoParams): string {
  const p = new URLSearchParams()
  p.set('de', params.de)
  p.set('ate', params.ate)

  const allTiposSelected =
    params.tipos.length === ALL_TIPOS.length && ALL_TIPOS.every((t) => params.tipos.includes(t))
  if (!allTiposSelected && params.tipos.length > 0) p.set('tipos', params.tipos.join(','))

  if (params.categorias.length > 0) p.set('categorias', params.categorias.join(','))
  if (params.contas.length > 0) p.set('contas', params.contas.join(','))
  if (params.q) p.set('q', params.q)
  if (params.cursor) p.set('cursor', params.cursor)

  return `/historico?${p.toString()}`
}
