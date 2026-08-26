import { beforeAll, describe, expect, it } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createAccount,
  createCategory,
  createCategoryGroup,
  createFixedExpense,
  createInstallmentGroup,
  createTransaction,
  createUser,
} from './helpers/factories'
import { ALL_TIPOS } from '@/lib/utils/historico-params'

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

describe('getAllInvestmentWithdrawals', () => {
  it('inclui resgate anterior à janela de 6 meses de getInvestmentWithdrawals', async () => {
    const { createInvestmentType } = await import('./helpers/factories')
    const { id: typeId } = await createInvestmentType(db, userId, { name: 'CDB Antigo' })

    await db.insert((await import('@/lib/db/schema')).investmentWithdrawals).values({
      userId,
      investmentTypeId: typeId,
      amount: '900.00',
      taxAmount: '100.00',
      date: '2020-05-10',
      destination: 'income',
    })

    const { getAllInvestmentWithdrawals, getInvestmentWithdrawals } =
      await import('@/lib/queries/investments')

    const all = await getAllInvestmentWithdrawals(userId)
    const recent = await getInvestmentWithdrawals(userId)

    const antigo = all.find((w) => w.date === '2020-05-10')
    expect(antigo).toBeDefined()
    expect(antigo?.amount).toBe(900)
    expect(antigo?.taxAmount).toBe(100)
    expect(recent.some((w) => w.date === '2020-05-10')).toBe(false)
  })
})

describe('getAllInvestmentEntries', () => {
  it('traz aportes de todos os tipos, com rendimento e flag de fluxo de caixa', async () => {
    const { createInvestmentType } = await import('./helpers/factories')
    const { id: typeId } = await createInvestmentType(db, userId, { name: 'Tesouro' })

    await db.insert((await import('@/lib/db/schema')).investments).values({
      userId,
      investmentTypeId: typeId,
      amount: '500.00',
      yieldAmount: '25.50',
      referenceMonth: '2021-03-01',
      excludeFromCashFlow: true,
      notes: 'rolagem',
    })

    const { getAllInvestmentEntries } = await import('@/lib/queries/investments')
    const rows = await getAllInvestmentEntries(userId)

    const entry = rows.find((r) => r.referenceMonth === '2021-03-01')
    expect(entry?.typeName).toBe('Tesouro')
    expect(entry?.amount).toBe(500)
    expect(entry?.yieldAmount).toBe(25.5)
    expect(entry?.excludeFromCashFlow).toBe(true)
  })
})

describe('getAllBudgetOverrides', () => {
  it('devolve uma linha por mês, não só o mês corrente', async () => {
    const schema = await import('@/lib/db/schema')
    await db.insert(schema.monthlyBudgetOverrides).values([
      { userId, categoryId, referenceMonth: '2024-01-01', amount: '300.00' },
      { userId, categoryId, referenceMonth: '2024-02-01', amount: '450.00' },
    ])

    const { getAllBudgetOverrides } = await import('@/lib/queries/categories')
    const rows = await getAllBudgetOverrides(userId)

    const meses = rows
      .filter((r) => r.referenceMonth.startsWith('2024-'))
      .map((r) => r.referenceMonth)
    expect(meses.sort()).toEqual(['2024-01-01', '2024-02-01'])
    expect(rows.find((r) => r.referenceMonth === '2024-02-01')?.amount).toBe(450)
  })
})

describe('getEarliestActivityDate', () => {
  it('devolve a data mais antiga entre as tabelas de movimento', async () => {
    await createTransaction(db, userId, accountId, {
      categoryId,
      date: '2019-07-04',
      referenceMonth: '2019-07-01',
      amount: '10.00',
    })

    const { getEarliestActivityDate } = await import('@/lib/queries/historico')
    expect(await getEarliestActivityDate(userId)).toBe('2019-07-04')
  })

  it('devolve null para usuário sem movimento nenhum', async () => {
    const { id: vazio } = await createUser(db, `vazio-${Date.now()}`)
    const { getEarliestActivityDate } = await import('@/lib/queries/historico')
    expect(await getEarliestActivityDate(vazio)).toBeNull()
  })
})

describe('getLatestActivityDate', () => {
  it('usa a data de exibição do gasto fixo (referenceMonth + dueDay), não o referenceMonth cru', async () => {
    const { id: soFixo } = await createUser(db, `so-fixo-${Date.now()}`)
    const { id: contaFixo } = await createAccount(db, soFixo)
    const grupoFixo = await createCategoryGroup(db, soFixo)
    const { id: categoriaFixo } = await createCategory(db, soFixo, grupoFixo.id)

    // referenceMonth 2024-06-01 com dueDay=20 exibe em 2024-06-20 — bem depois
    // do referenceMonth cru, que é o que o teto usava antes da correção.
    await createFixedExpense(db, soFixo, contaFixo, categoriaFixo, {
      name: 'Aluguel',
      amount: '1500.00',
      dueDay: 20,
      referenceMonth: '2024-06-01',
    })

    const { getLatestActivityDate, collectHistoricoItems } = await import('@/lib/queries/historico')
    const latest = await getLatestActivityDate(soFixo)
    expect(latest).toBe('2024-06-20')

    // Discriminante: com um teto anterior ao vencimento (a definição antiga,
    // MAX(referenceMonth) = '2024-06-01'), o gasto fixo continua fora do
    // recorte de collectHistoricoItems — comprova que fixedExpenseDate
    // segue sendo a única fonte da data de exibição.
    const itemsComTetoAntigo = await collectHistoricoItems(soFixo, {
      de: '2024-01-01',
      ate: '2024-06-01',
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    })
    expect(itemsComTetoAntigo.some((i) => i.name === 'Aluguel')).toBe(false)

    const itemsComTetoCorrigido = await collectHistoricoItems(soFixo, {
      de: '2024-01-01',
      ate: latest as string,
      tipos: [...ALL_TIPOS],
      categorias: [],
      contas: [],
      q: '',
      cursor: null,
    })
    expect(itemsComTetoCorrigido.some((i) => i.name === 'Aluguel')).toBe(true)
  })

  it('devolve null para usuário sem movimento nenhum', async () => {
    const { id: vazio } = await createUser(db, `vazio-latest-${Date.now()}`)
    const { getLatestActivityDate } = await import('@/lib/queries/historico')
    expect(await getLatestActivityDate(vazio)).toBeNull()
  })
})
