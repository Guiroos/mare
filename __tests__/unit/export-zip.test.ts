import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { createZip } from '@/lib/export/zip'

describe('createZip', () => {
  it('faz round-trip de nomes e conteúdo', () => {
    const buffer = createZip([
      { name: '01-extrato.csv', content: 'Descrição;Valor\r\nAçaí;10,00' },
      { name: '02-contas.csv', content: 'Nome\r\n"Conta; com ponto e vírgula"' },
    ])

    const out = unzipSync(new Uint8Array(buffer))

    expect(Object.keys(out).sort()).toEqual(['01-extrato.csv', '02-contas.csv'])
    expect(strFromU8(out['01-extrato.csv'])).toBe('Descrição;Valor\r\nAçaí;10,00')
    expect(strFromU8(out['02-contas.csv'])).toBe('Nome\r\n"Conta; com ponto e vírgula"')
  })

  it('preserva o BOM UTF-8 que o Excel pt-BR exige', () => {
    const buffer = createZip([{ name: 'a.csv', content: '﻿Nome;Valor' }])
    const bytes = unzipSync(new Uint8Array(buffer))['a.csv']

    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })

  it('aceita lista vazia sem estourar', () => {
    const buffer = createZip([])
    expect(Object.keys(unzipSync(new Uint8Array(buffer)))).toEqual([])
  })
})
