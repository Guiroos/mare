import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Varredura de código-fonte compartilhada pelos gates por string
// (no-err-message, investment-type-archive-error, dependencies).

export const ROOT = process.cwd()

const IGNORED_DIRS = new Set(['node_modules', '.next', '.git'])

export function collectFiles(dir: string, extension?: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath, extension))
    } else if (!extension || entry.endsWith(extension)) {
      files.push(fullPath)
    }
  }
  return files
}
