#!/usr/bin/env npx tsx
/**
 * Corrige referenceMonth e date de parcelas futuras criadas com a lógica antiga.
 *
 * Escopo:
 *   - Apenas transações com installmentGroupId IS NOT NULL
 *   - Apenas referenceMonth > currentReferenceMonth (parcelas futuras)
 *   - Parcela 1: apenas referenceMonth é recalculado; date não é alterada
 *   - Parcelas 2+: date e referenceMonth são recalculados
 *
 * Uso:
 *   npx tsx scripts/fix-installment-dates.ts --dry-run   # apenas imprime o diff
 *   npx tsx scripts/fix-installment-dates.ts              # aplica as correções
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { and, eq, gt, isNotNull, inArray } from 'drizzle-orm'
import { addMonths, format } from 'date-fns'
import * as schema from '../lib/db/schema'
import {
  parseDate,
  calcBaseReferenceMonth,
  calcInstallmentDate,
  currentReferenceMonth,
} from '../lib/utils/date'

const isDryRun = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: true })
const db = drizzle(pool, { schema })

async function main() {
  const today = currentReferenceMonth()

  // 1. Buscar todos os grupos com pelo menos uma parcela futura
  const futureRows = await db
    .select({
      installmentGroupId: schema.transactions.installmentGroupId,
    })
    .from(schema.transactions)
    .where(
      and(
        isNotNull(schema.transactions.installmentGroupId),
        gt(schema.transactions.referenceMonth, today)
      )
    )

  const groupIds = Array.from(new Set(futureRows.map((r) => r.installmentGroupId!)))

  if (groupIds.length === 0) {
    console.log('Nenhum grupo com parcelas futuras encontrado.')
    await pool.end()
    return
  }

  // 2. Buscar grupos com closingDay via join
  const groups = await db
    .select({
      id: schema.installmentGroups.id,
      startDate: schema.installmentGroups.startDate,
      closingDay: schema.paymentAccounts.closingDay,
    })
    .from(schema.installmentGroups)
    .leftJoin(
      schema.paymentAccounts,
      eq(schema.installmentGroups.accountId, schema.paymentAccounts.id)
    )
    .where(inArray(schema.installmentGroups.id, groupIds))

  // 3. Buscar todas as parcelas futuras desses grupos
  const futureParcelas = await db
    .select({
      id: schema.transactions.id,
      installmentGroupId: schema.transactions.installmentGroupId,
      installmentNumber: schema.transactions.installmentNumber,
      date: schema.transactions.date,
      referenceMonth: schema.transactions.referenceMonth,
    })
    .from(schema.transactions)
    .where(
      and(
        isNotNull(schema.transactions.installmentGroupId),
        inArray(schema.transactions.installmentGroupId, groupIds),
        gt(schema.transactions.referenceMonth, today)
      )
    )

  // 4. Para cada grupo calcular os novos valores
  type Update = { id: string; newDate: string; newReferenceMonth: string }
  const updates: Update[] = []
  let groupsChanged = 0
  let groupsUnchanged = 0

  for (const group of groups) {
    const closingDay = group.closingDay ?? null
    const purchaseDate = parseDate(group.startDate)
    const baseReferenceMonth = calcBaseReferenceMonth(purchaseDate, closingDay)

    const parcelas = futureParcelas.filter((p) => p.installmentGroupId === group.id)
    let changed = false

    for (const parcela of parcelas) {
      if (parcela.installmentNumber === null) continue
      const i = parcela.installmentNumber - 1
      const newRefMonth = addMonths(baseReferenceMonth, i)
      const newRefMonthStr = format(newRefMonth, 'yyyy-MM-dd')
      const newDateStr =
        i === 0 ? parcela.date : format(calcInstallmentDate(newRefMonth, closingDay), 'yyyy-MM-dd')

      if (newRefMonthStr !== parcela.referenceMonth || newDateStr !== parcela.date) {
        if (isDryRun) {
          console.log(
            `  parcela ${parcela.installmentNumber}: date ${parcela.date} → ${newDateStr} | referenceMonth ${parcela.referenceMonth} → ${newRefMonthStr}`
          )
        }
        updates.push({ id: parcela.id, newDate: newDateStr, newReferenceMonth: newRefMonthStr })
        changed = true
      }
    }

    if (changed) {
      groupsChanged++
      if (isDryRun) {
        console.log(
          `[DRY-RUN] Grupo ${group.id} (closingDay=${closingDay ?? 'null'}) — ${parcelas.length} parcela(s) futura(s) acima`
        )
      }
    } else {
      groupsUnchanged++
    }
  }

  console.log(
    `\nResumo: ${groupIds.length} grupo(s) com parcelas futuras | ${groupsChanged} com mudanças | ${groupsUnchanged} sem mudanças | ${updates.length} linha(s) a atualizar`
  )

  if (isDryRun || updates.length === 0) {
    console.log(isDryRun ? '[DRY-RUN] Nenhuma alteração aplicada.' : 'Nada a atualizar.')
    await pool.end()
    return
  }

  // 5. Aplicar dentro de uma transaction
  await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx
        .update(schema.transactions)
        .set({ date: u.newDate, referenceMonth: u.newReferenceMonth })
        .where(eq(schema.transactions.id, u.id))
    }
  })

  console.log(`${updates.length} linha(s) atualizada(s) com sucesso.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
