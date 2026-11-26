import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, collectFiles } from './helpers/source-files'

// Varre app/, components/, hooks/, lib/, scripts/, types/ e arquivos
// *.config.* na raiz do repo em busca de cada dependência de produção
// declarada no package.json. Uma dependência sem nenhuma ocorrência é peso
// morto em `dependencies` (superfície de supply chain sem contrapartida) —
// ver issue #50.

const SCAN_DIRS = ['app', 'components', 'hooks', 'lib', 'scripts', 'types']

// Peer dependency que o Next.js usa internamente para renderizar — nenhum
// arquivo do app importa `react-dom` pelo nome, mas ela é indispensável.
const ALLOWLIST = new Set(['react-dom'])

function rootConfigFiles(): string[] {
  return readdirSync(ROOT)
    .filter((entry) => entry.includes('.config.'))
    .map((entry) => join(ROOT, entry))
}

// Pontos de entrada que só rodam em tempo de build, na máquina de build — nunca
// em produção. Uma dependência de produção cujos ÚNICOS importadores estão aqui
// está classificada errada (deveria ser devDependency): infla a árvore de
// produção do lockfile e corrompe `npm audit --omit=dev` (issue #102).
// `app/sw.ts` NÃO entra: compila para `public/sw.js`, que executa no navegador
// do usuário — `serwist` é dependência de runtime (#149).
function buildEntryPoints(): string[] {
  return rootConfigFiles()
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

  // Direção inversa (#149): devDependency importada por código que roda em
  // produção (Client Component, service worker) some de `npm audit --omit=dev`.
  // Só `rootConfigFiles()` é ferramenta pura de build; `app/sw.ts` vira
  // `public/sw.js` e executa no navegador, então conta como runtime.
  it('no devDependency is imported from runtime code', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const devDependencies = Object.keys(pkg.devDependencies as Record<string, string>)

    const configFiles = new Set(rootConfigFiles())
    // `dotenv` roda à mão em scripts/ e no seed de dev (tsx), nunca em produção.
    const devOnlyImporters = (file: string) =>
      file.startsWith(join(ROOT, 'scripts') + '/') ||
      file === join(ROOT, 'lib', 'db', 'seed-dev.ts')

    const runtimeFiles = SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir)))
      .filter((file) => !configFiles.has(file))
      .filter((file) => !devOnlyImporters(file))
    // Comentários citam pacotes entre crases (ex: `@serwist/next/config`) sem importá-los.
    const contents = runtimeFiles.map((file) =>
      readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
    )

    const misclassified = devDependencies.filter((dep) =>
      contents.some((content) => importSpecifierRegex(dep).test(content))
    )

    expect(misclassified).toEqual([])
  })

  // Os pacotes `@vitest/*` declaram `peerDependencies: { vitest: "<versão exata>" }`.
  // Um bump que mova só um lado (PR #162: `vitest` 5.0.1 com `@vitest/coverage-v8`
  // 4.1.9) estoura ERESOLVE no `npm ci` antes de qualquer gate rodar — ver issue
  // #164. O `npm ci` já detecta; isto dá o diagnóstico com o nome do par.
  it('every direct @vitest/* package is pinned to the same version as vitest', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const all: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies }

    const mismatched = Object.entries(all)
      .filter(([name]) => name.startsWith('@vitest/'))
      .filter(([, version]) => version !== all.vitest)
      .map(([name, version]) => `${name}@${version} (vitest@${all.vitest})`)

    expect(mismatched).toEqual([])
  })
})
