import { describe, it, expect, vi } from 'vitest'
import {
  parseHistoricoParams,
  buildHistoricoUrl,
  filterUuids,
  ALL_TIPOS,
} from '@/lib/utils/historico-params'

vi.mock('@/lib/auth/require-user', () => ({
  requireUserId: vi.fn().mockResolvedValue('11111111-1111-4111-8111-111111111111'),
}))
vi.mock('@/lib/queries/historico', () => ({
  getHistoricoFeed: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}))

describe('parseHistoricoParams', () => {
  it('usa defaults quando sem params', () => {
    const result = parseHistoricoParams({})
    expect(result.tipos).toEqual([...ALL_TIPOS])
    expect(result.categorias).toEqual([])
    expect(result.contas).toEqual([])
    expect(result.q).toBe('')
    expect(result.cursor).toBeNull()
    // de e ate devem ser strings de data válidas
    expect(result.de).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.ate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // de deve ser ~90 dias antes de ate
    const de = new Date(result.de)
    const ate = new Date(result.ate)
    const diffDays = Math.round((ate.getTime() - de.getTime()) / 86400000)
    expect(diffDays).toBe(90)
  })

  it('parseia tipos como array separado por vírgula', () => {
    const result = parseHistoricoParams({ tipos: 'entrada,saida_avulsa' })
    expect(result.tipos).toEqual(['entrada', 'saida_avulsa'])
  })

  it('ignora tipos inválidos', () => {
    const result = parseHistoricoParams({ tipos: 'entrada,tipo_invalido' })
    expect(result.tipos).toEqual(['entrada'])
  })

  it('parseia categorias e contas como arrays de uuid', () => {
    const result = parseHistoricoParams({
      categorias: '11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222',
      contas: '33333333-3333-4333-8333-333333333333',
    })
    expect(result.categorias).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ])
    expect(result.contas).toEqual(['33333333-3333-4333-8333-333333333333'])
  })

  it('descarta categorias/contas que não são uuid', () => {
    const result = parseHistoricoParams({ categorias: 'abc', contas: "' OR 1=1--" })
    expect(result.categorias).toEqual([])
    expect(result.contas).toEqual([])
  })

  it('descarta uuid truncado (35 caracteres hex)', () => {
    const result = parseHistoricoParams({
      categorias: '00000000-0000-0000-0000-00000000000',
    })
    expect(result.categorias).toEqual([])
  })

  it('filtra por item em vez de descartar o array inteiro', () => {
    const result = parseHistoricoParams({
      categorias: `abc,11111111-1111-4111-8111-111111111111`,
    })
    expect(result.categorias).toEqual(['11111111-1111-4111-8111-111111111111'])
  })

  it('parseia datas explícitas', () => {
    const result = parseHistoricoParams({ de: '2025-01-15', ate: '2025-06-14' })
    expect(result.de).toBe('2025-01-15')
    expect(result.ate).toBe('2025-06-14')
  })

  it('parseia cursor', () => {
    const result = parseHistoricoParams({ cursor: '2025-03-10_uuid-abc' })
    expect(result.cursor).toBe('2025-03-10_uuid-abc')
  })

  it('cai no default quando de/ate são inválidos', () => {
    const result = parseHistoricoParams({ de: 'abc', ate: '2025-13-99' })
    expect(result.de).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.ate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.de).not.toBe('abc')
    expect(result.ate).not.toBe('2025-13-99')
  })

  it('troca de/ate quando o intervalo vem invertido', () => {
    const result = parseHistoricoParams({ de: '2025-06-14', ate: '2025-01-15' })
    expect(result.de).toBe('2025-01-15')
    expect(result.ate).toBe('2025-06-14')
  })

  it('rejeita datas que não existem no calendário', () => {
    const result = parseHistoricoParams({ de: '2025-02-29', ate: '2025-06-31' })
    expect(result.de).not.toBe('2025-02-29')
    expect(result.ate).not.toBe('2025-06-31')
  })

  it('aceita 29/02 em ano bissexto', () => {
    const result = parseHistoricoParams({ de: '2024-02-29', ate: '2024-03-01' })
    expect(result.de).toBe('2024-02-29')
  })
})

describe('buildHistoricoUrl', () => {
  it('serializa params como query string', () => {
    const url = buildHistoricoUrl({
      de: '2025-01-15',
      ate: '2025-06-14',
      tipos: ['entrada', 'saida_avulsa'],
      categorias: ['uuid1'],
      contas: [],
      q: 'mercado',
      cursor: null,
    })
    expect(url).toContain('de=2025-01-15')
    expect(url).toContain('ate=2025-06-14')
    expect(url).toContain('tipos=entrada%2Csaida_avulsa')
    expect(url).toContain('categorias=uuid1')
    expect(url).not.toContain('contas=')
    expect(url).toContain('q=mercado')
    expect(url).not.toContain('cursor=')
  })

  it('omite tipos quando todos estão selecionados', () => {
    const url = buildHistoricoUrl({
      de: '2025-01-15',
      ate: '2025-06-14',
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    })
    expect(url).not.toContain('tipos=')
  })

  it('inclui cursor quando presente', () => {
    const url = buildHistoricoUrl({
      de: '2025-01-15',
      ate: '2025-06-14',
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: '2025-03-10_uuid-abc',
    })
    expect(url).toContain('cursor=2025-03-10_uuid-abc')
  })
})

describe('filterUuids', () => {
  it('mantém só entradas que são uuid válido', () => {
    expect(
      filterUuids([
        '11111111-1111-4111-8111-111111111111',
        'abc',
        '00000000-0000-0000-0000-00000000000',
      ])
    ).toEqual(['11111111-1111-4111-8111-111111111111'])
  })
})

describe('fetchMoreHistorico', () => {
  it('descarta categorias/contas que não são uuid antes de consultar o banco', async () => {
    const { fetchMoreHistorico } = await import('@/lib/actions/historico')
    const { getHistoricoFeed } = await import('@/lib/queries/historico')

    await fetchMoreHistorico({
      de: '2025-01-15',
      ate: '2025-06-14',
      tipos: [...ALL_TIPOS],
      categorias: ['abc', '11111111-1111-4111-8111-111111111111'],
      contas: ['abc'],
      q: '',
      cursor: null,
    })

    expect(getHistoricoFeed).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        categorias: ['11111111-1111-4111-8111-111111111111'],
        contas: [],
      })
    )
  })

  it('degrada de/ate inválidos para o default de 90 dias antes de consultar o banco', async () => {
    const { fetchMoreHistorico } = await import('@/lib/actions/historico')
    const { getHistoricoFeed } = await import('@/lib/queries/historico')

    await fetchMoreHistorico({
      de: '2025-02-30',
      ate: '2025-06-31',
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    })

    expect(getHistoricoFeed).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        de: expect.not.stringMatching(/^2025-02-30$/),
        ate: expect.not.stringMatching(/^2025-06-31$/),
      })
    )
  })
})
