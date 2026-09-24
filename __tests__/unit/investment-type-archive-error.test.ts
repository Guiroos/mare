import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Gate por string sobre o código-fonte (#143). `catch {}` sem binding que
// afirma uma causa de negócio específica ("Não é possível X com Y") é sempre
// suspeito: se a causa real fosse capturada, ela estaria no binding. Aqui o
// caso é mais forte — o gate de render (`archiveAction`) só oferece o botão
// que dispara `handleArchive` quando o saldo já é zero, a negação exata do
// guard de `archiveInvestmentType` (lib/actions/investments.ts) — então a
// falha "tipo com saldo" nunca é a causa real quando o catch roda. O que
// sobra (sessão expirada, ownership, rede) precisa de mensagem genérica.
// Precedente: __tests__/unit/row-actions.test.ts (readFileSync + asserção
// sobre conteúdo do arquivo) e __tests__/unit/no-err-message.test.ts (varre
// app/ e components/ procurando um padrão proibido).
//
// O regex ancora na frase de negócio específica, não em `toast.error`
// genérico — 'Não foi possível excluir. Tente novamente.' (row-actions.tsx)
// é a forma correta já mergeada e não pode virar falso-positivo.

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

const CATCH_AFFIRMS_BUSINESS_CAUSE = /catch\s*\{[^}]*toast\.error\(\s*'Não é possível [^']*'\s*\)/

describe('catch de mutação não afirma causa sem registrar a exceção real (#143)', () => {
  it('nenhum catch sem binding afirma uma causa de negócio específica', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectTsxFiles(join(ROOT, dir)))

    const ofensores = files
      .filter((file) => CATCH_AFFIRMS_BUSINESS_CAUSE.test(readFileSync(file, 'utf-8')))
      .map((file) => file.replace(ROOT + '/', ''))

    expect(ofensores).toEqual([])
  })

  it('InvestmentTypeCard registra a exceção real e usa mensagem genérica', () => {
    const src = readFileSync(join(ROOT, 'components/investimentos/InvestmentTypeCard.tsx'), 'utf-8')
    expect(src).toMatch(/catch\s*\(err\)\s*\{\s*console\.error\([^)]*archiveInvestmentType/)
    expect(src).toContain("toast.error('Não foi possível arquivar. Tente novamente.')")
    expect(src).not.toContain("toast.error('Não é possível arquivar tipo com saldo.')")
  })

  it('InvestmentTypeAccordion registra a exceção real e usa mensagem genérica', () => {
    const src = readFileSync(
      join(ROOT, 'components/investimentos/InvestmentTypeAccordion.tsx'),
      'utf-8'
    )
    expect(src).toMatch(/catch\s*\(err\)\s*\{\s*console\.error\([^)]*archiveInvestmentType/)
    expect(src).toContain("toast.error('Não foi possível arquivar. Tente novamente.')")
    expect(src).not.toContain("toast.error('Não é possível arquivar tipo com saldo.')")
  })
})
