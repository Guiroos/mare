import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, collectFiles } from './helpers/source-files'

// Toda função exportada de lib/queries/** precisa de ao menos uma referência
// fora da própria declaração. Query sem consumidor apodrece sem ninguém notar
// (a cópia morta de getMonthTransactions esqueceu de decriptar
// category.name/account.name — issue #172) e atrai o próximo autor pelo nome.
// A checagem é por identificador, não por caminho do módulo: um arquivo com
// funções vivas não pode esconder uma morta.

const SCAN_DIRS = ['app', 'components', 'hooks', 'lib', 'scripts', 'types', '__tests__']
const EXPORT_RE = /export\s+(?:async\s+)?function\s+(\w+)/g

function sourceFiles(): { path: string; content: string }[] {
  return SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir)))
    .filter((f) => /\.(ts|tsx|mts)$/.test(f))
    .map((path) => ({ path, content: readFileSync(path, 'utf8') }))
}

describe('lib/queries — exports sem consumidor', () => {
  it('toda função exportada é referenciada fora da própria declaração', () => {
    const files = sourceFiles()
    const dead: string[] = []
    for (const file of files.filter((f) => f.path.includes(join('lib', 'queries') + '/'))) {
      for (const match of file.content.matchAll(EXPORT_RE)) {
        const name = match[1]
        const ref = new RegExp(`\\b${name}\\b`, 'g')
        // Comentário não conta como consumidor; 1 ocorrência = só a declaração.
        let inCode = 0
        for (const f of files) {
          const code = f.content
            .split('\n')
            .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
            .join('\n')
          inCode += (code.match(ref) ?? []).length
        }
        if (inCode <= 1) dead.push(`${file.path.replace(ROOT + '/', '')}: ${name}`)
      }
    }
    expect(dead).toEqual([])
  })
})
