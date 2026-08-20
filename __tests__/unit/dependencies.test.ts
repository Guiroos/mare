import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Varre app/, components/, hooks/, lib/, scripts/, types/ e arquivos
// *.config.* na raiz do repo em busca de cada dependência de produção
// declarada no package.json. Uma dependência sem nenhuma ocorrência é peso
// morto em `dependencies` (superfície de supply chain sem contrapartida) —
// ver issue #50.

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib', 'scripts', 'types']
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

// Pontos de entrada que só rodam em tempo de build — nunca são importados pelo
// servidor em runtime. Uma dependência de produção cujos ÚNICOS importadores
// estão aqui está classificada errada (deveria ser devDependency): infla a
// árvore de produção do lockfile e corrompe `npm audit --omit=dev` (issue #102).
// `next.config.mjs` já casa com `rootConfigFiles()` (a substring `.config.`
// aparece em `next.config.mjs`). `app/sw.ts` NÃO — está dentro de `app/`
// (varrido pela outra checagem como se fosse runtime), então entra aqui
// explicitamente: compila para `public/sw.js`, artefato estático, e não é
// módulo de servidor.
function buildEntryPoints(): string[] {
  return [...rootConfigFiles(), join(ROOT, 'app', 'sw.ts')]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Casa só em especificador de import/require: 'dep', "dep/sub", `dep`.
// Um match de substring solto (ex: `content.includes(dep)`) deixaria
// `serwist`/`react`/`next` sempre "usados" por serem prefixo do nome de
// outro pacote importado (`@serwist/next`, `react-dom`, `next-auth`).
function importSpecifierRegex(dep: string): RegExp {
  return new RegExp(`['"\`]${escapeRegExp(dep)}(?:/[^'"\`]*)?['"\`]`)
}

describe('package.json dependencies', () => {
  it('every production dependency is imported somewhere in app/components/hooks/lib/scripts/types or *.config.*', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const dependencies = Object.keys(pkg.dependencies as Record<string, string>)

    const files = [
      ...SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir))),
      ...rootConfigFiles(),
    ]
    const contents = files.map((file) => readFileSync(file, 'utf-8'))

    const orphaned = dependencies
      .filter((dep) => !ALLOWLIST.has(dep))
      .filter((dep) => !contents.some((content) => importSpecifierRegex(dep).test(content)))

    expect(orphaned).toEqual([])
  })

  it('no production dependency is imported only from build-time entry points', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const dependencies = Object.keys(pkg.dependencies as Record<string, string>)

    const runtimeContents = [...SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir)))]
      .filter((file) => !buildEntryPoints().includes(file))
      .map((file) => readFileSync(file, 'utf-8'))

    const buildContents = buildEntryPoints().map((file) => readFileSync(file, 'utf-8'))

    // Uma dependência de produção precisa ter ao menos um importador fora dos
    // pontos de entrada de build. Se todos os importadores estão em build-time,
    // ela é build tooling classificada como runtime.
    const buildOnly = dependencies
      .filter((dep) => !ALLOWLIST.has(dep))
      .filter((dep) => buildContents.some((content) => importSpecifierRegex(dep).test(content)))
      .filter((dep) => !runtimeContents.some((content) => importSpecifierRegex(dep).test(content)))

    expect(buildOnly).toEqual([])
  })
})
