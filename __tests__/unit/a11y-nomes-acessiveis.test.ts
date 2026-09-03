import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── SplitSection — dois "X" idênticos sem nome acessível (#129) ──────────
//
// `lucide-react@1.8.0` (pinado em package.json) marca o <svg> do ícone como
// aria-hidden="true" quando não recebe filho nem prop de a11y — sem
// aria-label no <Button>, o role=button chega ao leitor de tela sem nome.
//
// SplitSection.tsx tem 5 <Button> no total (o "Dividir com alguém", os dois
// <X>, e mais dois no rodapé), e os dois sites em risco usam o mesmo ícone
// <X> — um `toMatch(/aria-label/)` genérico sobre o arquivo passaria com
// qualquer um deles rotulado, e um recorte que pegue só a primeira
// ocorrência deixaria o segundo site descoberto. O gate precisa: (1) achar
// os dois <Button> que envolvem um <X>, (2) exigir aria-label em ambos, e
// (3) exigir que os rótulos sejam distintos — o defeito original é a
// ambiguidade entre "fechar tudo" e "remover uma pessoa", não a ausência
// isolada de nome.

const splitSection = readFileSync(
  join(process.cwd(), 'components/forms/transaction/SplitSection.tsx'),
  'utf-8'
)

describe('SplitSection — os dois botões "X" têm nomes distintos (#129)', () => {
  it('tem exatamente dois <Button> envolvendo um <X>', () => {
    const gatilhos = [...splitSection.matchAll(/<Button\b(?:(?!<Button)[\s\S])*?<X\b/g)].map(
      (m) => m[0]
    )
    expect(gatilhos).toHaveLength(2)
  })

  it('cada gatilho tem aria-label, e os dois rótulos são distintos', () => {
    const gatilhos = [...splitSection.matchAll(/<Button\b(?:(?!<Button)[\s\S])*?<X\b/g)].map(
      (m) => m[0]
    )
    const rotulos = gatilhos.map((g) => g.match(/^\s*aria-label="([^"]+)"$/m)?.[1])

    expect(rotulos.every(Boolean)).toBe(true)
    expect(new Set(rotulos).size).toBe(2)
  })
})
