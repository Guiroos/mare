import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Varre app/, components/, lib/, scripts/ e arquivos *.config.* na raiz do
// repo em busca de cada dependência de produção declarada no package.json.
// Uma dependência sem nenhuma ocorrência é peso morto em `dependencies`
// (superfície de supply chain sem contrapartida) — ver issue #50.

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'lib', 'scripts']
const IGNORED_DIRS = new Set(['node_modules', '.next', '.git'])

// Peer dependency que o Next.js usa internamente para renderizar — nenhum
// arquivo do app importa `react-dom` pelo nome, mas ela é indispensável.
const ALLOWLIST = new Set(['react-dom'])

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function rootConfigFiles(): string[] {
  return readdirSync(ROOT)
    .filter((entry) => entry.includes('.config.'))
    .map((entry) => join(ROOT, entry))
}

describe('package.json dependencies', () => {
  it('every production dependency is imported somewhere in app/components/lib/scripts or *.config.*', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const dependencies = Object.keys(pkg.dependencies as Record<string, string>)

    const files = [
      ...SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir))),
      ...rootConfigFiles(),
    ]
    const contents = files.map((file) => readFileSync(file, 'utf-8'))

    const orphaned = dependencies
      .filter((dep) => !ALLOWLIST.has(dep))
      .filter((dep) => !contents.some((content) => content.includes(dep)))

    expect(orphaned).toEqual([])
  })
})
