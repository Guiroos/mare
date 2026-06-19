#!/usr/bin/env npx tsx
/**
 * Criptografa dados existentes no banco usando o DEK de cada usuário.
 * Idempotente: campos com prefixo 'enc:' são pulados.
 *
 * Uso:
 *   npx tsx scripts/encrypt-existing-data.ts --dry-run  # imprime contagens sem modificar
 *   npx tsx scripts/encrypt-existing-data.ts             # aplica criptografia
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { generateDek, encryptDek, decryptDek } from '../lib/crypto/keys'
import { encryptField, encryptOptional } from '../lib/crypto/fields'

const isDryRun = process.argv.includes('--dry-run')
const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const db = drizzle(pool, { schema })

const PREFIX = 'enc:'
function isEncrypted(val: string | null | undefined): boolean {
  return val != null && val.startsWith(PREFIX)
}

async function getOrCreateDek(userId: string): Promise<Buffer> {
  const row = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
    columns: { encryptedDek: true },
  })

  if (row?.encryptedDek) return decryptDek(row.encryptedDek)

  const dek = generateDek()
  const encryptedDekVal = encryptDek(dek)

  if (!isDryRun) {
    await db
      .insert(schema.userSettings)
      .values({ userId, encryptedDek: encryptedDekVal })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { encryptedDek: encryptedDekVal },
      })
  }
  return dek
}

async function main() {
  console.log(
    isDryRun ? '[DRY RUN] Nenhuma modificação será feita.' : '[APLICANDO] Criptografando dados...'
  )

  const users = await db.select({ id: schema.users.id }).from(schema.users)
  console.log(`Usuários encontrados: ${users.length}`)

  let totalUpdated = 0

  for (const { id: userId } of users) {
    const dek = await getOrCreateDek(userId)
    let userUpdated = 0

    // ─── transactions ───────────────────────────────────────────────────────────
    const txRows = await db
      .select({
        id: schema.transactions.id,
        name: schema.transactions.name,
        amount: schema.transactions.amount,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))

    for (const row of txRows) {
      if (isEncrypted(row.name) && isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db
          .update(schema.transactions)
          .set({
            name: isEncrypted(row.name) ? row.name : encryptField(row.name, dek),
            amount: isEncrypted(row.amount) ? row.amount : encryptField(row.amount, dek),
          })
          .where(eq(schema.transactions.id, row.id))
      }
      userUpdated++
    }

    // ─── fixedExpenses ──────────────────────────────────────────────────────────
    const fxRows = await db
      .select({
        id: schema.fixedExpenses.id,
        name: schema.fixedExpenses.name,
        amount: schema.fixedExpenses.amount,
      })
      .from(schema.fixedExpenses)
      .where(eq(schema.fixedExpenses.userId, userId))

    for (const row of fxRows) {
      if (isEncrypted(row.name) && isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db
          .update(schema.fixedExpenses)
          .set({
            name: isEncrypted(row.name) ? row.name : encryptField(row.name, dek),
            amount: isEncrypted(row.amount) ? row.amount : encryptField(row.amount, dek),
          })
          .where(eq(schema.fixedExpenses.id, row.id))
      }
      userUpdated++
    }

    // ─── installmentGroups ──────────────────────────────────────────────────────
    const igRows = await db
      .select({
        id: schema.installmentGroups.id,
        name: schema.installmentGroups.name,
        totalAmount: schema.installmentGroups.totalAmount,
      })
      .from(schema.installmentGroups)
      .where(eq(schema.installmentGroups.userId, userId))

    for (const row of igRows) {
      if (isEncrypted(row.name) && isEncrypted(row.totalAmount)) continue
      if (!isDryRun) {
        await db
          .update(schema.installmentGroups)
          .set({
            name: isEncrypted(row.name) ? row.name : encryptField(row.name, dek),
            totalAmount: isEncrypted(row.totalAmount)
              ? row.totalAmount
              : encryptField(row.totalAmount, dek),
          })
          .where(eq(schema.installmentGroups.id, row.id))
      }
      userUpdated++
    }

    // ─── incomes ────────────────────────────────────────────────────────────────
    const incRows = await db
      .select({
        id: schema.incomes.id,
        source: schema.incomes.source,
        amount: schema.incomes.amount,
        investmentReturnCapital: schema.incomes.investmentReturnCapital,
      })
      .from(schema.incomes)
      .where(eq(schema.incomes.userId, userId))

    for (const row of incRows) {
      if (isEncrypted(row.source) && isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db
          .update(schema.incomes)
          .set({
            source: isEncrypted(row.source) ? row.source : encryptField(row.source, dek),
            amount: isEncrypted(row.amount) ? row.amount : encryptField(row.amount, dek),
            investmentReturnCapital: isEncrypted(row.investmentReturnCapital)
              ? row.investmentReturnCapital
              : encryptOptional(row.investmentReturnCapital, dek),
          })
          .where(eq(schema.incomes.id, row.id))
      }
      userUpdated++
    }

    // ─── investments ────────────────────────────────────────────────────────────
    const invRows = await db
      .select({
        id: schema.investments.id,
        amount: schema.investments.amount,
        yieldAmount: schema.investments.yieldAmount,
        notes: schema.investments.notes,
      })
      .from(schema.investments)
      .where(eq(schema.investments.userId, userId))

    for (const row of invRows) {
      const needsUpdate =
        !isEncrypted(row.amount) ||
        !isEncrypted(row.yieldAmount) ||
        (row.notes && !isEncrypted(row.notes))
      if (!needsUpdate) continue
      if (!isDryRun) {
        await db
          .update(schema.investments)
          .set({
            amount: isEncrypted(row.amount) ? row.amount : encryptOptional(row.amount, dek),
            yieldAmount: isEncrypted(row.yieldAmount)
              ? row.yieldAmount
              : encryptOptional(row.yieldAmount, dek),
            notes: isEncrypted(row.notes) ? row.notes : encryptOptional(row.notes, dek),
          })
          .where(eq(schema.investments.id, row.id))
      }
      userUpdated++
    }

    // ─── investmentWithdrawals ──────────────────────────────────────────────────
    const wdRows = await db
      .select({
        id: schema.investmentWithdrawals.id,
        amount: schema.investmentWithdrawals.amount,
        taxAmount: schema.investmentWithdrawals.taxAmount,
        notes: schema.investmentWithdrawals.notes,
      })
      .from(schema.investmentWithdrawals)
      .where(eq(schema.investmentWithdrawals.userId, userId))

    for (const row of wdRows) {
      if (isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db
          .update(schema.investmentWithdrawals)
          .set({
            amount: encryptField(row.amount, dek),
            taxAmount: encryptOptional(row.taxAmount, dek),
            notes: encryptOptional(row.notes, dek),
          })
          .where(eq(schema.investmentWithdrawals.id, row.id))
      }
      userUpdated++
    }

    // ─── goals ──────────────────────────────────────────────────────────────────
    const goalRows = await db
      .select({
        id: schema.goals.id,
        name: schema.goals.name,
        targetAmount: schema.goals.targetAmount,
      })
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId))

    for (const row of goalRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db
          .update(schema.goals)
          .set({
            name: encryptField(row.name, dek),
            targetAmount: encryptField(row.targetAmount, dek),
          })
          .where(eq(schema.goals.id, row.id))
      }
      userUpdated++
    }

    // ─── investmentTypes ────────────────────────────────────────────────────────
    const itRows = await db
      .select({ id: schema.investmentTypes.id, name: schema.investmentTypes.name })
      .from(schema.investmentTypes)
      .where(eq(schema.investmentTypes.userId, userId))

    for (const row of itRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db
          .update(schema.investmentTypes)
          .set({ name: encryptField(row.name, dek) })
          .where(eq(schema.investmentTypes.id, row.id))
      }
      userUpdated++
    }

    // ─── paymentAccounts ────────────────────────────────────────────────────────
    const paRows = await db
      .select({ id: schema.paymentAccounts.id, name: schema.paymentAccounts.name })
      .from(schema.paymentAccounts)
      .where(eq(schema.paymentAccounts.userId, userId))

    for (const row of paRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db
          .update(schema.paymentAccounts)
          .set({ name: encryptField(row.name, dek) })
          .where(eq(schema.paymentAccounts.id, row.id))
      }
      userUpdated++
    }

    // ─── categoryGroups ─────────────────────────────────────────────────────────
    const cgRows = await db
      .select({ id: schema.categoryGroups.id, name: schema.categoryGroups.name })
      .from(schema.categoryGroups)
      .where(eq(schema.categoryGroups.userId, userId))

    for (const row of cgRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db
          .update(schema.categoryGroups)
          .set({ name: encryptField(row.name, dek) })
          .where(eq(schema.categoryGroups.id, row.id))
      }
      userUpdated++
    }

    // ─── categories ─────────────────────────────────────────────────────────────
    const catRows = await db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        defaultBudget: schema.categories.defaultBudget,
      })
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId))

    for (const row of catRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db
          .update(schema.categories)
          .set({
            name: encryptField(row.name, dek),
            defaultBudget: encryptOptional(row.defaultBudget, dek),
          })
          .where(eq(schema.categories.id, row.id))
      }
      userUpdated++
    }

    // ─── monthlyBudgetOverrides ─────────────────────────────────────────────────
    const mboRows = await db
      .select({
        id: schema.monthlyBudgetOverrides.id,
        amount: schema.monthlyBudgetOverrides.amount,
      })
      .from(schema.monthlyBudgetOverrides)
      .where(eq(schema.monthlyBudgetOverrides.userId, userId))

    for (const row of mboRows) {
      if (isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db
          .update(schema.monthlyBudgetOverrides)
          .set({ amount: encryptField(row.amount, dek) })
          .where(eq(schema.monthlyBudgetOverrides.id, row.id))
      }
      userUpdated++
    }

    // ─── goalContributions ──────────────────────────────────────────────────────
    const gcRows = await db
      .select({ id: schema.goalContributions.id, amount: schema.goalContributions.amount })
      .from(schema.goalContributions)
      .where(eq(schema.goalContributions.userId, userId))

    for (const row of gcRows) {
      if (isEncrypted(row.amount)) continue
      if (!isDryRun) {
        await db
          .update(schema.goalContributions)
          .set({ amount: encryptField(row.amount, dek) })
          .where(eq(schema.goalContributions.id, row.id))
      }
      userUpdated++
    }

    // ─── people ─────────────────────────────────────────────────────────────────
    const pRows = await db
      .select({
        id: schema.people.id,
        name: schema.people.name,
        email: schema.people.email,
        phone: schema.people.phone,
        notes: schema.people.notes,
      })
      .from(schema.people)
      .where(eq(schema.people.userId, userId))

    for (const row of pRows) {
      if (isEncrypted(row.name)) continue
      if (!isDryRun) {
        await db
          .update(schema.people)
          .set({
            name: encryptField(row.name, dek),
            email: encryptOptional(row.email, dek),
            phone: encryptOptional(row.phone, dek),
            notes: encryptOptional(row.notes, dek),
          })
          .where(eq(schema.people.id, row.id))
      }
      userUpdated++
    }

    // ─── debtorEntries ──────────────────────────────────────────────────────────
    const deRows = await db
      .select({
        id: schema.debtorEntries.id,
        description: schema.debtorEntries.description,
        amount: schema.debtorEntries.amount,
        notes: schema.debtorEntries.notes,
      })
      .from(schema.debtorEntries)
      .where(eq(schema.debtorEntries.userId, userId))

    for (const row of deRows) {
      if (isEncrypted(row.description)) continue
      if (!isDryRun) {
        await db
          .update(schema.debtorEntries)
          .set({
            description: encryptField(row.description, dek),
            amount: encryptField(row.amount, dek),
            notes: encryptOptional(row.notes, dek),
          })
          .where(eq(schema.debtorEntries.id, row.id))
      }
      userUpdated++
    }

    // ─── userSettings.pixKey ────────────────────────────────────────────────────
    const settingsRow = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
      columns: { pixKey: true },
    })
    if (settingsRow?.pixKey && !isEncrypted(settingsRow.pixKey)) {
      if (!isDryRun) {
        await db
          .update(schema.userSettings)
          .set({ pixKey: encryptField(settingsRow.pixKey, dek) })
          .where(eq(schema.userSettings.userId, userId))
      }
      userUpdated++
    }

    // ─── feedback ───────────────────────────────────────────────────────────────
    const fbRows = await db
      .select({ id: schema.feedback.id, message: schema.feedback.message })
      .from(schema.feedback)
      .where(eq(schema.feedback.userId, userId))

    for (const row of fbRows) {
      if (isEncrypted(row.message)) continue
      if (!isDryRun) {
        await db
          .update(schema.feedback)
          .set({ message: encryptField(row.message, dek) })
          .where(eq(schema.feedback.id, row.id))
      }
      userUpdated++
    }

    console.log(
      `  userId=${userId}: ${userUpdated} registros ${isDryRun ? 'a cifrar' : 'cifrados'}`
    )
    totalUpdated += userUpdated
  }

  console.log(
    `\nTotal: ${totalUpdated} registros ${isDryRun ? 'seriam cifrados' : 'cifrados com sucesso'}.`
  )
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
