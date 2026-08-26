import { beforeAll, describe, expect, it } from 'vitest'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createAccount,
  createCategory,
  createCategoryGroup,
  createFixedExpense,
  createGoal,
  createGoalContribution,
  createInstallmentGroup,
  createInvestmentType,
  createPerson,
  createCharge,
  createTransaction,
  createUser,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string
let futureISODate: string

/**
 * Popula um usuário com dado CIFRADO nos 12 domínios.
 *
 * Os factories inserem plaintext, e decryptField é backward-compat: repassa
 * plaintext adiante sem erro. Um dump montado sobre dado de factory nunca
 * conteria "enc:" nem com a query errada — o assert de vazamento passaria
 * vazio. Cifrar aqui é o que dá sentido àquele teste.
 */
beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `export-completo-${Date.now()}`))

  const { getDekForUser } = await import('@/lib/crypto/keys')
  const { encryptField } = await import('@/lib/crypto/fields')
  const dek = await getDekForUser(userId)
  const enc = (v: string) => encryptField(v, dek)

  const { id: accountId } = await createAccount(db, userId, {
    name: enc('Nubank'),
    type: 'credit',
    closingDay: 8,
  })
  const { id: groupId } = await createCategoryGroup(db, userId, enc('Essenciais'))
  const { id: categoryId } = await createCategory(db, userId, groupId, {
    name: enc('Mercado'),
    defaultBudget: enc('800.00'),
  })

  await createTransaction(db, userId, accountId, {
    categoryId,
    name: enc('Supermercado'),
    amount: enc('150.00'),
    date: '2025-01-10',
    referenceMonth: '2025-01-01',
  })

  const schema = await import('@/lib/db/schema')
  await db.insert(schema.monthlyBudgetOverrides).values({
    userId,
    categoryId,
    referenceMonth: '2025-02-01',
    amount: enc('900.00'),
  })

  const { id: instGroupId } = await createInstallmentGroup(db, userId, accountId, categoryId, {
    name: enc('Notebook'),
    totalAmount: enc('1200.00'),
    totalInstallments: 12,
  })
  await createTransaction(db, userId, accountId, {
    categoryId,
    installmentGroupId: instGroupId,
    name: enc('Notebook (1/12)'),
    amount: enc('100.00'),
    date: '2025-01-05',
    referenceMonth: '2025-01-01',
  })

  const { id: typeId } = await createInvestmentType(db, userId, { name: enc('CDB') })
  await db.insert(schema.investments).values({
    userId,
    investmentTypeId: typeId,
    amount: enc('500.00'),
    yieldAmount: enc('25.00'),
    referenceMonth: '2025-01-01',
  })
  await db.insert(schema.investmentWithdrawals).values({
    userId,
    investmentTypeId: typeId,
    amount: enc('90.00'),
    taxAmount: enc('10.00'),
    date: '2025-02-10',
    destination: 'income',
  })

  const { id: goalId } = await createGoal(db, userId, {
    name: enc('Reserva'),
    targetAmount: enc('10000.00'),
  })
  await createGoalContribution(db, userId, goalId, { amount: enc('500.00') })

  // 2ª parcela com data futura: createInstallment grava as N linhas de uma vez,
  // então isso é o estado normal de uma compra parcelada, não caso de borda.
  const future = new Date()
  future.setMonth(future.getMonth() + 3)
  futureISODate = future.toISOString().slice(0, 10)
  await createTransaction(db, userId, accountId, {
    categoryId,
    installmentGroupId: instGroupId,
    name: enc('Notebook (2/12)'),
    amount: enc('100.00'),
    date: futureISODate,
    referenceMonth: `${futureISODate.slice(0, 7)}-01`,
  })

  const { id: personId } = await createPerson(db, userId, enc('João'))
  await createCharge(db, userId, personId, {
    amount: enc('100.00'),
    description: enc('Almoço'),
  })

  // Pessoa arquivada: por domínio, só se arquiva quem tem histórico — logo, os
  // lançamentos dela sempre existem e a aba de saldos precisa concordar.
  const [arquivada] = await db
    .insert(schema.people)
    .values({ userId, name: enc('Maria Arquivada'), archived: true })
    .returning({ id: schema.people.id })
  await createCharge(db, userId, arquivada.id, {
    amount: enc('250.00'),
    description: enc('Viagem'),
  })
})

describe('collectFullExport', () => {
  it('devolve as 12 planilhas na ordem declarada', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const sheets = await collectFullExport(userId)

    expect(sheets.map((s) => s.name)).toEqual([
      'Extrato',
      'Contas',
      'Categorias',
      'Orçamentos mensais',
      'Parcelas',
      'Investimentos — Tipos',
      'Investimentos — Aportes',
      'Investimentos — Resgates',
      'Metas',
      'Metas — Contribuições',
      'Devedores — Saldos',
      'Devedores — Lançamentos',
    ])
  })

  it('toda planilha tem cabeçalho e o filename é único', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const sheets = await collectFullExport(userId)

    for (const sheet of sheets) {
      expect(sheet.data.length).toBeGreaterThanOrEqual(1)
      expect(sheet.widths).toHaveLength(sheet.data[0].length)
    }

    const filenames = sheets.map((s) => s.filename)
    expect(new Set(filenames).size).toBe(filenames.length)
  })

  it('o extrato cobre desde a atividade mais antiga, sem janela de 90 dias', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const sheets = await collectFullExport(userId)
    const extrato = sheets.find((s) => s.name === 'Extrato')

    // 2 transações criadas em 2025-01, muito além dos 90 dias padrão
    expect(extrato!.data.length).toBeGreaterThanOrEqual(3)
  })

  it('o extrato inclui parcela com data futura', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')
    const sheets = await collectFullExport(userId)
    const extrato = sheets.find((s) => s.name === 'Extrato')!

    // Com teto em "hoje" a 2/12 sai do dump e a aba Parcelas passa a mentir:
    // reporta 12 parcelas enquanto o extrato traz só a 1ª.
    const csv = sheetToCsv(extrato.data)
    expect(csv).toContain('Notebook (2/12)')
    expect(csv).toContain(futureISODate.slice(0, 4))
  })

  it('o extrato inclui gasto fixo do mês seguinte com vencimento ainda não chegado', async () => {
    // Usuário isolado: getLatestActivityDate agrega por userId, então o teto
    // real desse usuário depende só do gasto fixo criado aqui.
    const { id: fxUserId } = await createUser(db, `export-completo-fx-${Date.now()}`)
    const { id: fxAccountId } = await createAccount(db, fxUserId)
    const { id: fxGroupId } = await createCategoryGroup(db, fxUserId)
    const { id: fxCategoryId } = await createCategory(db, fxUserId, fxGroupId)

    // Mês seguinte, não "hoje + N dias": referenceMonth precisa ser um dia 01,
    // e dueDay=15 fixo é determinístico em qualquer dia do mês em que o CI rodar
    // (ao contrário de um dueDay fixo relativo ao dia corrente).
    const proximoMes = new Date()
    proximoMes.setMonth(proximoMes.getMonth() + 1)
    const proximoMesISO = `${proximoMes.toISOString().slice(0, 7)}-01`

    await createFixedExpense(db, fxUserId, fxAccountId, fxCategoryId, {
      name: 'Aluguel Futuro',
      dueDay: 15,
      referenceMonth: proximoMesISO,
    })

    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')
    const sheets = await collectFullExport(fxUserId)
    const extrato = sheets.find((s) => s.name === 'Extrato')!

    // Com o teto antigo (MAX(referenceMonth) = dia 01 do mês seguinte, já
    // "> hoje"), o gasto fixo com vencimento no dia 15 caía fora do recorte
    // de collectHistoricoItems e sumia do extrato.
    expect(sheetToCsv(extrato.data)).toContain('Aluguel Futuro')
  })

  it('pessoa arquivada aparece na aba de saldos, não só na de lançamentos', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')
    const sheets = await collectFullExport(userId)

    // Assert por aba, não sobre o dump concatenado: contra o dump o teste
    // passaria pela presença na aba de lançamentos, com o bug intacto.
    const saldos = sheets.find((s) => s.name === 'Devedores — Saldos')!
    const lancamentos = sheets.find((s) => s.name === 'Devedores — Lançamentos')!

    expect(sheetToCsv(saldos.data)).toContain('Maria Arquivada')
    expect(sheetToCsv(lancamentos.data)).toContain('Maria Arquivada')
  })
})

describe('GET /api/export/completo', () => {
  it('nenhuma célula do dump vaza ciphertext', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')

    const sheets = await collectFullExport(userId)
    const dump = sheets.map((s) => sheetToCsv(s.data)).join('\n')

    expect(dump).not.toMatch(/enc:/)
  })

  it('o dump contém os valores decriptados que foram cifrados no setup', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')

    const sheets = await collectFullExport(userId)
    const dump = sheets.map((s) => sheetToCsv(s.data)).join('\n')

    // Um valor por domínio cifrado no beforeAll — se algum sumir, a query errou
    expect(dump).toContain('Nubank')
    expect(dump).toContain('Mercado')
    expect(dump).toContain('Supermercado')
    expect(dump).toContain('Notebook')
    expect(dump).toContain('CDB')
    expect(dump).toContain('Reserva')
    expect(dump).toContain('João')
  })

  it('o ZIP tem um csv por planilha, com prefixo numérico', async () => {
    const { unzipSync } = await import('fflate')
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { sheetToCsv } = await import('@/lib/export/csv')
    const { createZip } = await import('@/lib/export/zip')

    const sheets = await collectFullExport(userId)
    const buffer = createZip(
      sheets.map((s) => ({ name: `${s.filename}.csv`, content: sheetToCsv(s.data) }))
    )

    const names = Object.keys(unzipSync(new Uint8Array(buffer)))
    expect(names).toHaveLength(12)
    expect(names).toContain('01-extrato.csv')
    expect(names).toContain('12-devedores-lancamentos.csv')
  })

  it('o xlsx sai como buffer não-vazio com assinatura de zip', async () => {
    const { collectFullExport } = await import('@/lib/export/full/collect')
    const { writeFullXlsx } = await import('@/lib/export/full/xlsx')

    const buffer = await writeFullXlsx(await collectFullExport(userId))

    expect(buffer.length).toBeGreaterThan(0)
    expect(Array.from(buffer.subarray(0, 2))).toEqual([0x50, 0x4b]) // "PK"
  })
})
