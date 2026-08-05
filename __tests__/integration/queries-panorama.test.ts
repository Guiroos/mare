import { vi, describe, it, expect, beforeAll } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { currentYear, pastNMonths } from '@/lib/utils/date'
import {
  createUser,
  createCategoryGroup,
  createCategory,
  createAccount,
  createTransaction,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

neonTestingSetup()

let db: TestDb

beforeAll(() => {
  db = createTestDb()
})

// ─── getAnnualOverview — definição de "conta de crédito" em modo fatura ──────
// Regressão da issue #36: `getAnnualOverview` excluía qualquer conta
// `type='credit'`, enquanto a definição canônica (usada por `getDashboardData`
// via `getCreditAccounts`) só exclui as que também têm `closingDay > 1`. Um
// cartão sem dia de fechamento configurado ficava fora de `creditAccountIds`
// mas ainda assim desaparecia do total anual do Panorama.

describe('getAnnualOverview — conta de crédito sem closingDay não é excluída em modo fatura', () => {
  it('despesa em cartão fora de creditAccountIds soma normalmente; a configurada é excluída', async () => {
    const { id: userId } = await createUser(db, `panorama-fatura-${Date.now()}`)
    const { id: configuredCreditId } = await createAccount(db, userId, {
      name: 'Cartão configurado',
      type: 'credit',
      closingDay: 10,
    })
    const { id: unconfiguredCreditId } = await createAccount(db, userId, {
      name: 'Cartão sem fechamento',
      type: 'credit',
      closingDay: null,
    })
    const { id: debitId } = await createAccount(db, userId, { type: 'debit' })
    const { id: groupId } = await createCategoryGroup(db, userId)
    const { id: catId } = await createCategory(db, userId, groupId)

    const [refMonth] = pastNMonths(1)
    const day15 = `${refMonth.slice(0, 7)}-15`

    await createTransaction(db, userId, debitId, {
      amount: '100.00',
      referenceMonth: refMonth,
      date: day15,
      categoryId: catId,
    })
    await createTransaction(db, userId, configuredCreditId, {
      amount: '500.00',
      referenceMonth: refMonth,
      date: day15,
      categoryId: catId,
    })
    await createTransaction(db, userId, unconfiguredCreditId, {
      amount: '450.00',
      referenceMonth: refMonth,
      date: day15,
      categoryId: catId,
    })

    const { getAnnualOverview } = await import('@/lib/queries/panorama')
    // creditAccountIds reflete getCreditAccounts: só a conta com closingDay > 1 entra
    const overview = await getAnnualOverview(userId, currentYear(), {
      creditMode: 'fatura',
      faturaActiveFrom: refMonth,
      creditAccountIds: [configuredCreditId],
    })

    const month = overview.find((m) => m.month === refMonth.slice(0, 7))
    expect(month).toBeDefined()
    // R$ 100 (débito) + R$ 450 (cartão sem fechamento, não é conta de fatura) = R$ 550
    // O cartão configurado (R$ 500) é excluído por estar em creditAccountIds
    expect(month!.totalExpenses).toBeCloseTo(550, 1)
  })
})
