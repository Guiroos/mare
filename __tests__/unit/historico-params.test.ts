import { describe, it, expect } from 'vitest'
import { parseHistoricoParams, buildHistoricoUrl, ALL_TIPOS } from '@/lib/utils/historico-params'

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

  it('parseia categorias e contas como arrays', () => {
    const result = parseHistoricoParams({ categorias: 'uuid1,uuid2', contas: 'uuid3' })
    expect(result.categorias).toEqual(['uuid1', 'uuid2'])
    expect(result.contas).toEqual(['uuid3'])
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
