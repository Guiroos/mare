import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Gate por string sobre o código-fonte (#122). `err.message`/`error.message`
// dentro de um `catch` de componente é sempre o parágrafo genérico do React
// em produção — erro que atravessa a fronteira de Server Action chega ao
// cliente como um `Error` reconstruído por `resolveErrorProd`, então
// `err instanceof Error` é sempre verdadeiro e `.message` nunca é a
// mensagem lançada pela action. Precedente: __tests__/unit/row-actions.test.ts
// (mesma técnica de readFileSync + asserção sobre o conteúdo do arquivo).

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components']
const IGNORED_DIRS = new Set(['node_modules', '.next', '.git'])

function collectTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...collectTsxFiles(fullPath))
    } else if (entry.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }
  return files
}

// Âncora em `catch` para não pegar `errors.message`/`next.message` usados
// como chave de mapa de erros de formulário (ex: FeedbackDialog.tsx), que
// não têm relação com mensagem de exceção mascarada em produção.
const CATCH_ERR_MESSAGE = /catch[\s\S]{0,200}?\b(?:err|error|e)\s*\.\s*message\b/

describe('nenhum componente exibe err.message em catch (#122)', () => {
  it('a mensagem de erro de Server Action é mascarada em produção — ler err.message nunca mostra a mensagem real', () => {
    const files = [...SCAN_DIRS.flatMap((dir) => collectTsxFiles(join(ROOT, dir)))]

    const ofensores = files
      .filter((file) => CATCH_ERR_MESSAGE.test(readFileSync(file, 'utf-8')))
      .map((file) => file.replace(ROOT + '/', ''))

    expect(ofensores).toEqual([])
  })
})
