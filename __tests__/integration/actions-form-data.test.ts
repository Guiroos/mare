import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createAccount,
  createCategoryGroup,
  createCategory,
  createTransaction,
  createIncome,
} from './helpers/factories'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))

neonTestingSetup()

// Dia fixo dentro do mês testado — `getRegistrationFormData` usa o mês corrente
// internamente (sem parâmetro), então o "hoje" precisa ser travado.
const TODAY = new Date('2025-06-15T12:00:00Z')
const MONTH_REF = '2025-06-01'

let db: TestDb

beforeAll(() => {
  db = createTestDb()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
})

afterAll(() => {
  vi.useRealTimers()
})

// ─── Divergência 1 — capital de resgate reinvestido não pode inflar o saldo ────

describe('getRegistrationFormData — capital de resgate não infla o saldo do mês', () => {
  it('currentBalance subtrai investmentReturnCapital, igual ao dashboard', async () => {
    const { id: userId } = await createUser(db, `form-data-return-capital-${Date.now()}`)

    // Rolagem de investimento: entra como income com investmentReturnCapital = amount
    // (mesmo shape que createWithdrawal grava em lib/actions/investments.ts)
    await createIncome(db, userId, {
      amount: '1000.00',
      investmentReturnCapital: '1000.00',
      referenceMonth: MONTH_REF,
    })
    // Entrada comum — deve contar normalmente
    await createIncome(db, userId, {
      amount: '500.00',
      referenceMonth: MONTH_REF,
    })

    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockResolvedValue(userId)

    const { getRegistrationFormData } = await import('@/lib/actions/form-data')
    const formData = await getRegistrationFormData()

    // Sem o capital de retorno, o saldo seria 1500 — a rolagem não é caixa novo
    expect(formData.currentBalance).toBeCloseTo(500, 1)
  })
})

// ─── Divergência 2 — regime de fatura: /registro precisa bater com o dashboard ─

describe('getRegistrationFormData — regime de fatura bate com getDashboardData', () => {
  it('currentBalance exclui compras no cartão de crédito, igual ao dashboard', async () => {
    const { id: userId } = await createUser(db, `form-data-fatura-${Date.now()}`)
    const { id: creditId } = await createAccount(db, userId, {
      name: 'Cartão',
      type: 'credit',
      closingDay: 10,
    })
    // type='credit' mas closingDay<=1: conta de calendário (.claude/domain-fatura.md),
    // NÃO entra em creditAccountIds — distingue getCreditAccounts (closingDay>1) de um
    // filtro ingênuo por `type === 'credit'`, que incluiria as duas contas igualmente.
    const { id: calendarCreditId } = await createAccount(db, userId, {
      name: 'Cartão sem fechamento',
      type: 'credit',
      closingDay: 1,
    })
    const { id: groupId } = await createCategoryGroup(db, userId)
    const { id: catId } = await createCategory(db, userId, groupId)

    await db.insert(schema.userSettings).values({
      userId,
      creditMode: 'fatura',
      faturaActiveFrom: MONTH_REF,
      updatedAt: new Date(),
    })

    await createIncome(db, userId, { amount: '3000.00', referenceMonth: MONTH_REF })
    // Compra no cartão de fatura: regime de fatura exclui do saldo do mês (entra só no
    // pagamento da fatura)
    await createTransaction(db, userId, creditId, {
      amount: '800.00',
      date: '2025-06-05',
      referenceMonth: MONTH_REF,
      categoryId: catId,
    })
    // Compra na conta de calendário: NÃO é excluída — se a action usasse um filtro
    // ingênuo por `type`, essa transação também sumiria do saldo e o teste não notaria
    await createTransaction(db, userId, calendarCreditId, {
      amount: '400.00',
      date: '2025-06-06',
      referenceMonth: MONTH_REF,
      categoryId: catId,
    })

    const { requireUserId } = await import('@/lib/auth/require-user')
    vi.mocked(requireUserId).mockResolvedValue(userId)

    const { getUserCreditMode } = await import('@/lib/queries/fatura')
    const { getCreditAccounts } = await import('@/lib/queries/categories')
    const { getDashboardData } = await import('@/lib/queries/dashboard')

    const creditMode = await getUserCreditMode(userId)
    const creditAccounts = await getCreditAccounts(userId)
    const faturaCtx = {
      creditMode: creditMode.creditMode,
      faturaActiveFrom: creditMode.faturaActiveFrom,
      creditAccountIds: creditAccounts.map((a) => a.id),
    }
    const dashboardData = await getDashboardData(userId, MONTH_REF, faturaCtx)

    const { getRegistrationFormData } = await import('@/lib/actions/form-data')
    const formData = await getRegistrationFormData()

    // Comparado contra o dashboard, não uma constante — é o acoplamento entre
    // as duas telas que está sendo defendido.
    expect(formData.currentBalance).toBeCloseTo(dashboardData.summary.balance, 1)
    // 3000 (renda) − 400 (compra na conta de calendário) = 2600. Os 800 do cartão de
    // fatura ficam de fora; um filtro ingênuo por `type` também excluiria os 400 e daria
    // 3000 — é essa diferença que a asserção acima, sozinha, não capturava.
    expect(formData.currentBalance).toBeCloseTo(2600, 1)
  })
})
