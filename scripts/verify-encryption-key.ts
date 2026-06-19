#!/usr/bin/env npx tsx
/**
 * Verifica se a ENCRYPTION_MASTER_KEY atual consegue descriptografar
 * os DEKs armazenados no banco. Não modifica nenhum dado.
 *
 * Uso:
 *   npx tsx scripts/verify-encryption-key.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { isNotNull } from 'drizzle-orm'
import { decryptDek } from '../lib/crypto/keys'
import * as schema from '../lib/db/schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const db = drizzle(pool, { schema })

async function main() {
  const rows = await db
    .select({ userId: schema.userSettings.userId, encryptedDek: schema.userSettings.encryptedDek })
    .from(schema.userSettings)
    .where(isNotNull(schema.userSettings.encryptedDek))

  if (rows.length === 0) {
    console.log('Nenhum DEK encontrado no banco — nenhum usuário foi criptografado ainda.')
    await pool.end()
    return
  }

  let ok = 0
  let fail = 0

  for (const row of rows) {
    try {
      decryptDek(row.encryptedDek!)
      ok++
    } catch {
      console.error(`✗ userId=${row.userId} — DEK não descriptografável com a chave atual`)
      fail++
    }
  }

  if (fail === 0) {
    console.log(`✓ Todos os ${ok} DEK(s) descriptografados com sucesso — chave correta.`)
  } else {
    console.error(
      `\n${fail} de ${rows.length} DEK(s) falharam — ENCRYPTION_MASTER_KEY incorreta ou banco errado.`
    )
  }

  await pool.end()
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
