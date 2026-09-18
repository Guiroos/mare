import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Gate por string sobre o código-fonte (revisão do #136). O contrato que protege
// contra apagar a conta antes de confirmar que a MEK do ambiente está saudável não
// é sobre a assinatura de `assertMekConfigured` — é sobre o call site: chamada sem
// argumento (nunca validando ciphertext de um usuário específico), antes da Fase 1
// de delete. `__tests__/unit/crypto/keys.test.ts` caracteriza a função; este gate
// amarra o uso dela em `resetAccount`, que é o que de fato impede a regressão —
// um teste sobre a função passa mesmo se alguém mover a chamada ou lhe dar DEK de
// um usuário específico, porque `getMek()` continua sendo chamado de algum jeito.
//
// Âncoras: `^\s*assertMekConfigured\(\)$/m` exige a linha inteira — um `indexOf`
// solto casaria primeiro com a menção dentro do comentário logo abaixo da chamada
// real. `'await db.transaction'`, não `'db.transaction'` — é a única ocorrência
// com `await` no arquivo, e a Fase 1 é onde o delete de fato começa.
const resetSource = readFileSync(join(process.cwd(), 'lib/actions/reset-account.ts'), 'utf-8')

describe('resetAccount chama a sonda de MEK antes de apagar (#136)', () => {
  it('assertMekConfigured() roda sem argumento, antes da Fase 1 de delete', () => {
    const sonda = resetSource.search(/^\s*assertMekConfigured\(\)$/m)
    const fase1 = resetSource.indexOf('await db.transaction')

    expect(sonda).toBeGreaterThan(-1)
    expect(fase1).toBeGreaterThan(-1)
    expect(sonda).toBeLessThan(fase1)
  })
})
