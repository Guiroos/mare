import { beforeAll, describe, expect, it } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createAccount,
  createCategory,
  createCategoryGroup,
  createInstallmentGroup,
  createTransaction,
  createUser,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let accountId: string
let categoryId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `export-queries-${Date.now()}`))
  ;({ id: accountId } = await createAccount(db, userId))
  const group = await createCategoryGroup(db, userId)
  ;({ id: categoryId } = await createCategory(db, userId, group.id))
})

describe('getAllInstallmentGroups', () => {
  it('inclui grupo já quitado, que getActiveInstallmentGroups esconde', async () => {
    const { id: groupId } = await createInstallmentGroup(db, userId, accountId, categoryId, {
      name: 'Quitado',
      totalAmount: '300.00',
      totalInstallments: 3,
      startDate: '2020-01-01',
    })

    // Três parcelas, todas em meses passados => paidInstallments === 3, remaining === 0
    for (const month of ['2020-01-01', '2020-02-01', '2020-03-01']) {
      await createTransaction(db, userId, accountId, {
        categoryId,
        installmentGroupId: groupId,
        referenceMonth: month,
        date: month,
        amount: '100.00',
      })
    }

    const { getAllInstallmentGroups, getActiveInstallmentGroups } =
      await import('@/lib/queries/parcelas')

    const all = await getAllInstallmentGroups(userId)
    const active = await getActiveInstallmentGroups(userId)

    expect(all.map((g) => g.id)).toContain(groupId)
    expect(active.map((g) => g.id)).not.toContain(groupId)

    const quitado = all.find((g) => g.id === groupId)
    expect(quitado?.paidInstallments).toBe(3)
    expect(quitado?.remainingInstallments).toBe(0)
  })
})
