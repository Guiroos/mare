import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

// O migrator do Drizzle só aplica migration cujo `when` é maior que o da última aplicada:
// migration renumerada com timestamp antigo é pulada em prod, sem erro.
const dir = join(process.cwd(), 'lib/db/migrations')
const { entries } = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')) as {
  entries: { idx: number; when: number; tag: string }[]
}

describe('drizzle migrations journal', () => {
  it('idx sequencial a partir de 0', () => {
    expect(entries.map((e) => e.idx)).toEqual(entries.map((_, i) => i))
  })

  it('when estritamente crescente', () => {
    entries.forEach((e, i) => {
      if (i > 0) expect(e.when, e.tag).toBeGreaterThan(entries[i - 1].when)
    })
  })

  it('cada .sql tem entrada no journal e vice-versa', () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, -4))
      .sort()
    expect(entries.map((e) => e.tag).sort()).toEqual(files)
  })
})
