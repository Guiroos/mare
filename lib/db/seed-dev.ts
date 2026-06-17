/**
 * Dev seed script — populates 6 months of realistic financial data (Dec/2025 → May/2026)
 * for the first user in the database.
 *
 * Usage: npx tsx lib/db/seed-dev.ts
 *
 * Warning: deletes all financial data for the target user before inserting.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const DEV_EMAIL = 'dev@local.dev'

// ── helpers ──────────────────────────────────────────────────────────────────

function refMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 6 reference months: Dec/2025 … May/2026 */
const MONTHS: { year: number; month: number }[] = [
  { year: 2025, month: 12 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
  { year: 2026, month: 3 },
  { year: 2026, month: 4 },
  { year: 2026, month: 5 },
]

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 Looking for dev user: ${DEV_EMAIL}`)

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEV_EMAIL))
    .limit(1)

  if (!user) {
    console.error(`User not found. Log in via Google OAuth first, then run this script.`)
    process.exit(1)
  }

  const uid = user.id
  console.log(`✅ Found user: ${user.name} (${uid})`)

  // ── cleanup ──────────────────────────────────────────────────────────────
  console.log('🗑️  Cleaning up existing financial data…')
  await db.delete(schema.goalContributions).where(eq(schema.goalContributions.userId, uid))
  await db.delete(schema.investmentWithdrawals).where(eq(schema.investmentWithdrawals.userId, uid))
  await db.delete(schema.investments).where(eq(schema.investments.userId, uid))
  await db.delete(schema.debtorEntries).where(eq(schema.debtorEntries.userId, uid))
  await db.delete(schema.people).where(eq(schema.people.userId, uid))
  await db.delete(schema.goals).where(eq(schema.goals.userId, uid))
  await db.delete(schema.investmentTypes).where(eq(schema.investmentTypes.userId, uid))
  await db.delete(schema.transactions).where(eq(schema.transactions.userId, uid))
  await db.delete(schema.installmentGroups).where(eq(schema.installmentGroups.userId, uid))
  await db.delete(schema.fixedExpenses).where(eq(schema.fixedExpenses.userId, uid))
  await db.delete(schema.incomes).where(eq(schema.incomes.userId, uid))
  await db
    .delete(schema.monthlyBudgetOverrides)
    .where(eq(schema.monthlyBudgetOverrides.userId, uid))
  await db.delete(schema.paymentAccounts).where(eq(schema.paymentAccounts.userId, uid))
  await db.delete(schema.categories).where(eq(schema.categories.userId, uid))
  await db.delete(schema.categoryGroups).where(eq(schema.categoryGroups.userId, uid))

  // ── category groups & categories ─────────────────────────────────────────
  console.log('📂 Inserting categories…')

  const [grpEssencial] = await db
    .insert(schema.categoryGroups)
    .values({ userId: uid, name: 'Essencial', sortOrder: 0 })
    .returning()

  const [grpEstilo] = await db
    .insert(schema.categoryGroups)
    .values({ userId: uid, name: 'Estilo de Vida', sortOrder: 1 })
    .returning()

  if (!grpEssencial || !grpEstilo) throw new Error('Failed to insert category groups')

  const essencialCats = await db
    .insert(schema.categories)
    .values([
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Mercado',
        defaultBudget: '600.00',
        color: '#2d6e3e',
        bgColor: '#e8f5ec',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Saúde',
        defaultBudget: '300.00',
        color: '#1a6b5e',
        bgColor: '#e4f2f0',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Uber/transporte',
        defaultBudget: '250.00',
        color: '#7a5c00',
        bgColor: '#fdf6e0',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Pets',
        defaultBudget: '200.00',
        color: '#7a4200',
        bgColor: '#fdf0e4',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Aluguel',
        defaultBudget: null,
        color: '#2e4a7a',
        bgColor: '#e8eef6',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Contas',
        defaultBudget: '300.00',
        color: '#4d2e8a',
        bgColor: '#ece8f5',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Necessidades',
        defaultBudget: '150.00',
        color: '#5c4a1a',
        bgColor: '#f4f0e6',
      },
      {
        userId: uid,
        groupId: grpEssencial.id,
        name: 'Desenvolvimento',
        defaultBudget: null,
        color: '#2e3e8a',
        bgColor: '#e8eaf5',
      },
    ])
    .returning()

  const estiloCats = await db
    .insert(schema.categories)
    .values([
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'IFood/restaurante',
        defaultBudget: '400.00',
        color: '#9e2e1e',
        bgColor: '#fde8e6',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Eletrônicos',
        defaultBudget: '300.00',
        color: '#1e3e7a',
        bgColor: '#e6eef6',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Lazer',
        defaultBudget: '500.00',
        color: '#8a1e8a',
        bgColor: '#f6e4f6',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Presentes',
        defaultBudget: '300.00',
        color: '#8a1a4a',
        bgColor: '#f6e4ec',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Beleza',
        defaultBudget: '120.00',
        color: '#5e2a8a',
        bgColor: '#f2e6f6',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Assinaturas',
        defaultBudget: '250.00',
        color: '#0e4e5e',
        bgColor: '#e4f0f4',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Jogos',
        defaultBudget: '100.00',
        color: '#4a1a8e',
        bgColor: '#ece6f8',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Roupa',
        defaultBudget: '200.00',
        color: '#8a2a2a',
        bgColor: '#f6e8e8',
      },
      {
        userId: uid,
        groupId: grpEstilo.id,
        name: 'Despesas eventuais',
        defaultBudget: '200.00',
        color: '#363e50',
        bgColor: '#eaecf0',
      },
    ])
    .returning()

  const cat = {
    mercado: essencialCats[0]!,
    saude: essencialCats[1]!,
    transporte: essencialCats[2]!,
    pets: essencialCats[3]!,
    aluguel: essencialCats[4]!,
    contas: essencialCats[5]!,
    necessidades: essencialCats[6]!,
    desenvolvimento: essencialCats[7]!,
    ifood: estiloCats[0]!,
    eletronicos: estiloCats[1]!,
    lazer: estiloCats[2]!,
    presentes: estiloCats[3]!,
    beleza: estiloCats[4]!,
    assinaturas: estiloCats[5]!,
    jogos: estiloCats[6]!,
    roupa: estiloCats[7]!,
    eventuais: estiloCats[8]!,
  }

  // ── payment accounts ──────────────────────────────────────────────────────
  console.log('💳 Inserting payment accounts…')

  const accounts = await db
    .insert(schema.paymentAccounts)
    .values([
      { userId: uid, name: 'Nubank Crédito', type: 'credit', closingDay: 5 },
      { userId: uid, name: 'Nubank Conta', type: 'debit', closingDay: null },
      { userId: uid, name: 'PIX/Transferência', type: 'pix', closingDay: null },
    ])
    .returning()

  const acc = {
    credito: accounts[0]!,
    debito: accounts[1]!,
    pix: accounts[2]!,
  }

  // ── incomes ───────────────────────────────────────────────────────────────
  console.log('💰 Inserting incomes…')

  const incomeData: (typeof schema.incomes.$inferInsert)[] = []
  for (const { year, month } of MONTHS) {
    const rm = refMonth(year, month)
    // Salário fixo
    incomeData.push({ userId: uid, source: 'Salário', amount: '6500.00', referenceMonth: rm })
    // Freelance em meses alternados
    if (month % 2 === 0) {
      incomeData.push({ userId: uid, source: 'Freelance', amount: '1200.00', referenceMonth: rm })
    }
  }
  await db.insert(schema.incomes).values(incomeData)

  // ── fixed expenses ────────────────────────────────────────────────────────
  console.log('📋 Inserting fixed expenses…')

  const fixedDefs = [
    { name: 'Aluguel', amount: '1800.00', dueDay: 5, catId: cat.aluguel.id, accId: acc.pix.id },
    {
      name: 'Academia Smart Fit',
      amount: '99.90',
      dueDay: 10,
      catId: cat.saude.id,
      accId: acc.credito.id,
    },
    {
      name: 'Netflix',
      amount: '45.90',
      dueDay: 15,
      catId: cat.assinaturas.id,
      accId: acc.credito.id,
    },
    {
      name: 'Spotify',
      amount: '21.90',
      dueDay: 15,
      catId: cat.assinaturas.id,
      accId: acc.credito.id,
    },
    {
      name: 'Internet Vivo Fibra',
      amount: '99.90',
      dueDay: 20,
      catId: cat.contas.id,
      accId: acc.debito.id,
    },
    {
      name: 'Plano de Saúde',
      amount: '350.00',
      dueDay: 8,
      catId: cat.saude.id,
      accId: acc.debito.id,
    },
    {
      name: 'Celular (Tim)',
      amount: '59.90',
      dueDay: 12,
      catId: cat.contas.id,
      accId: acc.debito.id,
    },
    {
      name: 'Seguro Carro',
      amount: '180.00',
      dueDay: 25,
      catId: cat.contas.id,
      accId: acc.debito.id,
    },
  ]

  const fixedExpensesData: (typeof schema.fixedExpenses.$inferInsert)[] = []
  for (const { year, month } of MONTHS) {
    const rm = refMonth(year, month)
    // All months paid except current (May/2026)
    const isPaid = !(year === 2026 && month === 5)
    for (const def of fixedDefs) {
      fixedExpensesData.push({
        userId: uid,
        accountId: def.accId,
        categoryId: def.catId,
        name: def.name,
        amount: def.amount,
        dueDay: def.dueDay,
        paid: isPaid,
        referenceMonth: rm,
      })
    }
  }
  await db.insert(schema.fixedExpenses).values(fixedExpensesData)

  // ── installment groups ────────────────────────────────────────────────────
  console.log('🛒 Inserting installment groups…')

  const [igNotebook] = await db
    .insert(schema.installmentGroups)
    .values({
      userId: uid,
      accountId: acc.credito.id,
      categoryId: cat.eletronicos.id,
      name: 'Notebook Dell XPS',
      totalAmount: '3000.00',
      totalInstallments: 12,
      startDate: dateStr(2025, 12, 10),
    })
    .returning()

  const [igViagem] = await db
    .insert(schema.installmentGroups)
    .values({
      userId: uid,
      accountId: acc.credito.id,
      categoryId: cat.lazer.id,
      name: 'Viagem Florianópolis',
      totalAmount: '2700.00',
      totalInstallments: 6,
      startDate: dateStr(2026, 2, 15),
    })
    .returning()

  if (!igNotebook || !igViagem) throw new Error('Failed to insert installment groups')

  // ── transactions ──────────────────────────────────────────────────────────
  console.log('🧾 Inserting transactions…')

  type TxDef = {
    name: string
    amount: string
    day: number
    catId: string
    accId: string
    year: number
    month: number
    installmentGroupId?: string
    installmentNumber?: number
    totalInstallments?: number
  }

  const txDefs: TxDef[] = []

  // Notebook parcelas (12x R$ 250) — Dec/2025 to Nov/2026
  const notebookMonths = [
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
    { year: 2026, month: 4 },
    { year: 2026, month: 5 },
  ]
  notebookMonths.forEach(({ year, month }, i) => {
    txDefs.push({
      name: `Notebook Dell XPS (${i + 1}/12)`,
      amount: '250.00',
      day: 10,
      catId: cat.eletronicos.id,
      accId: acc.credito.id,
      year,
      month,
      installmentGroupId: igNotebook.id,
      installmentNumber: i + 1,
      totalInstallments: 12,
    })
  })

  // Viagem parcelas (6x R$ 450) — Feb/2026 to Jul/2026 (only first 4 in our window)
  const viagemMonths = [
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
    { year: 2026, month: 4 },
    { year: 2026, month: 5 },
  ]
  viagemMonths.forEach(({ year, month }, i) => {
    txDefs.push({
      name: `Viagem Florianópolis (${i + 1}/6)`,
      amount: '450.00',
      day: 15,
      catId: cat.lazer.id,
      accId: acc.credito.id,
      year,
      month,
      installmentGroupId: igViagem.id,
      installmentNumber: i + 1,
      totalInstallments: 6,
    })
  })

  // Variable transactions per month
  const varTxByMonth: Omit<TxDef, 'year' | 'month'>[][] = [
    // Dec/2025
    [
      {
        name: 'Supermercado Pão de Açúcar',
        amount: '285.40',
        day: 3,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      { name: 'Feira livre', amount: '95.60', day: 14, catId: cat.mercado.id, accId: acc.pix.id },
      {
        name: 'Supermercado Extra',
        amount: '198.30',
        day: 22,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Pizza',
        amount: '72.50',
        day: 6,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Hambúrguer',
        amount: '58.90',
        day: 13,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Restaurante Churrascaria',
        amount: '145.00',
        day: 28,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — trabalho',
        amount: '38.20',
        day: 5,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — final de semana',
        amount: '62.10',
        day: 20,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Camiseta Reserva',
        amount: '129.90',
        day: 7,
        catId: cat.roupa.id,
        accId: acc.credito.id,
      },
      {
        name: 'Cinema + pipoca',
        amount: '68.00',
        day: 18,
        catId: cat.lazer.id,
        accId: acc.credito.id,
      },
      {
        name: 'Steam — jogo Black Friday',
        amount: '89.90',
        day: 2,
        catId: cat.jogos.id,
        accId: acc.credito.id,
      },
      {
        name: 'Presente Natal família',
        amount: '350.00',
        day: 21,
        catId: cat.presentes.id,
        accId: acc.credito.id,
      },
      {
        name: 'Ração Dog Chow 15kg',
        amount: '189.90',
        day: 4,
        catId: cat.pets.id,
        accId: acc.credito.id,
      },
      {
        name: 'Consulta veterinária',
        amount: '120.00',
        day: 16,
        catId: cat.pets.id,
        accId: acc.pix.id,
      },
      {
        name: 'Curso Udemy — Next.js',
        amount: '47.90',
        day: 9,
        catId: cat.desenvolvimento.id,
        accId: acc.credito.id,
      },
    ],
    // Jan/2026
    [
      {
        name: 'Supermercado Pão de Açúcar',
        amount: '310.20',
        day: 4,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      { name: 'Hortifruti', amount: '88.40', day: 12, catId: cat.mercado.id, accId: acc.pix.id },
      {
        name: 'Supermercado Carrefour',
        amount: '220.60',
        day: 25,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Sushi',
        amount: '98.00',
        day: 8,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Lanches',
        amount: '45.60',
        day: 17,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Restaurante italiano',
        amount: '132.00',
        day: 25,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — trabalho',
        amount: '44.50',
        day: 6,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — saída',
        amount: '28.90',
        day: 19,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Farmácia Drogasil',
        amount: '67.80',
        day: 11,
        catId: cat.saude.id,
        accId: acc.credito.id,
      },
      {
        name: 'Show de stand-up',
        amount: '90.00',
        day: 18,
        catId: cat.lazer.id,
        accId: acc.credito.id,
      },
      {
        name: 'Churrasco com amigos',
        amount: '85.00',
        day: 26,
        catId: cat.lazer.id,
        accId: acc.pix.id,
      },
      {
        name: 'Ração Dog Chow 15kg',
        amount: '189.90',
        day: 5,
        catId: cat.pets.id,
        accId: acc.credito.id,
      },
      {
        name: 'Livro Clean Architecture',
        amount: '62.90',
        day: 14,
        catId: cat.desenvolvimento.id,
        accId: acc.credito.id,
      },
    ],
    // Feb/2026
    [
      {
        name: 'Supermercado Pão de Açúcar',
        amount: '295.80',
        day: 3,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      { name: 'Feira livre', amount: '72.20', day: 10, catId: cat.mercado.id, accId: acc.pix.id },
      {
        name: 'Supermercado Extra',
        amount: '185.40',
        day: 21,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Pizza',
        amount: '65.40',
        day: 7,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Japonês',
        amount: '88.90',
        day: 14,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      { name: 'Bar com amigos', amount: '110.00', day: 22, catId: cat.ifood.id, accId: acc.pix.id },
      {
        name: 'Uber — trabalho',
        amount: '51.30',
        day: 5,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — viagem aeroporto',
        amount: '78.50',
        day: 14,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Farmácia Drogasil',
        amount: '43.20',
        day: 9,
        catId: cat.saude.id,
        accId: acc.credito.id,
      },
      {
        name: 'Camisa social',
        amount: '159.90',
        day: 5,
        catId: cat.roupa.id,
        accId: acc.credito.id,
      },
      { name: 'Barbearia', amount: '55.00', day: 11, catId: cat.beleza.id, accId: acc.pix.id },
      {
        name: 'Ração Dog Chow 15kg',
        amount: '189.90',
        day: 6,
        catId: cat.pets.id,
        accId: acc.credito.id,
      },
      {
        name: 'Pousada Florianópolis',
        amount: '320.00',
        day: 16,
        catId: cat.lazer.id,
        accId: acc.credito.id,
      },
    ],
    // Mar/2026
    [
      {
        name: 'Supermercado Pão de Açúcar',
        amount: '318.50',
        day: 2,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      { name: 'Hortifruti', amount: '91.30', day: 11, catId: cat.mercado.id, accId: acc.pix.id },
      {
        name: 'Supermercado Carrefour',
        amount: '210.80',
        day: 22,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Hambúrguer',
        amount: '55.90',
        day: 6,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Mexicano',
        amount: '78.40',
        day: 15,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Pizza',
        amount: '62.00',
        day: 28,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — trabalho',
        amount: '39.60',
        day: 4,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Gasolina',
        amount: '120.00',
        day: 18,
        catId: cat.transporte.id,
        accId: acc.debito.id,
      },
      {
        name: 'Consulta médica particular',
        amount: '250.00',
        day: 13,
        catId: cat.saude.id,
        accId: acc.credito.id,
      },
      { name: 'Cinema', amount: '48.00', day: 20, catId: cat.lazer.id, accId: acc.credito.id },
      { name: 'Barbearia', amount: '55.00', day: 13, catId: cat.beleza.id, accId: acc.pix.id },
      {
        name: 'Ração Dog Chow 15kg',
        amount: '189.90',
        day: 3,
        catId: cat.pets.id,
        accId: acc.credito.id,
      },
      {
        name: 'Petshop — banho e tosa',
        amount: '80.00',
        day: 17,
        catId: cat.pets.id,
        accId: acc.pix.id,
      },
      {
        name: 'Calçado Nike',
        amount: '289.90',
        day: 8,
        catId: cat.roupa.id,
        accId: acc.credito.id,
      },
      {
        name: 'Curso Alura — React',
        amount: '79.90',
        day: 24,
        catId: cat.desenvolvimento.id,
        accId: acc.credito.id,
      },
    ],
    // Apr/2026
    [
      {
        name: 'Supermercado Pão de Açúcar',
        amount: '302.40',
        day: 3,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      { name: 'Feira livre', amount: '85.70', day: 13, catId: cat.mercado.id, accId: acc.pix.id },
      {
        name: 'Supermercado Extra',
        amount: '195.60',
        day: 24,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Sushi',
        amount: '105.00',
        day: 5,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Lanches',
        amount: '52.40',
        day: 18,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Jantar aniversário',
        amount: '180.00',
        day: 22,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — trabalho',
        amount: '42.80',
        day: 7,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — evento',
        amount: '35.90',
        day: 23,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Farmácia — vitaminas',
        amount: '89.90',
        day: 10,
        catId: cat.saude.id,
        accId: acc.credito.id,
      },
      {
        name: 'Show de música',
        amount: '150.00',
        day: 19,
        catId: cat.lazer.id,
        accId: acc.credito.id,
      },
      {
        name: 'Presente aniversário amigo',
        amount: '120.00',
        day: 21,
        catId: cat.presentes.id,
        accId: acc.pix.id,
      },
      {
        name: 'Ração Dog Chow 15kg',
        amount: '189.90',
        day: 4,
        catId: cat.pets.id,
        accId: acc.credito.id,
      },
      { name: 'Barbearia', amount: '55.00', day: 11, catId: cat.beleza.id, accId: acc.pix.id },
      {
        name: 'Camiseta polo',
        amount: '89.90',
        day: 14,
        catId: cat.roupa.id,
        accId: acc.credito.id,
      },
    ],
    // May/2026
    [
      {
        name: 'Supermercado Pão de Açúcar',
        amount: '325.60',
        day: 2,
        catId: cat.mercado.id,
        accId: acc.credito.id,
      },
      { name: 'Hortifruti', amount: '78.40', day: 10, catId: cat.mercado.id, accId: acc.pix.id },
      {
        name: 'iFood — Pizza',
        amount: '68.90',
        day: 4,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'iFood — Sushi',
        amount: '95.00',
        day: 11,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Uber — trabalho',
        amount: '45.20',
        day: 5,
        catId: cat.transporte.id,
        accId: acc.credito.id,
      },
      {
        name: 'Farmácia Drogasil',
        amount: '55.30',
        day: 8,
        catId: cat.saude.id,
        accId: acc.credito.id,
      },
      {
        name: 'Bar Dia das Mães',
        amount: '195.00',
        day: 11,
        catId: cat.ifood.id,
        accId: acc.credito.id,
      },
      {
        name: 'Presente Dia das Mães',
        amount: '280.00',
        day: 10,
        catId: cat.presentes.id,
        accId: acc.credito.id,
      },
      {
        name: 'Ração Dog Chow 15kg',
        amount: '189.90',
        day: 3,
        catId: cat.pets.id,
        accId: acc.credito.id,
      },
      { name: 'Barbearia', amount: '55.00', day: 9, catId: cat.beleza.id, accId: acc.pix.id },
      {
        name: 'Steam — jogo novo',
        amount: '74.90',
        day: 6,
        catId: cat.jogos.id,
        accId: acc.credito.id,
      },
    ],
  ]

  const allTxs: (typeof schema.transactions.$inferInsert)[] = []
  MONTHS.forEach(({ year, month }, idx) => {
    const rm = refMonth(year, month)
    const varTxs = varTxByMonth[idx] ?? []
    for (const tx of varTxs) {
      allTxs.push({
        userId: uid,
        accountId: tx.accId,
        categoryId: tx.catId,
        name: tx.name,
        amount: tx.amount,
        date: dateStr(year, month, tx.day),
        referenceMonth: rm,
      })
    }
  })

  for (const tx of txDefs) {
    allTxs.push({
      userId: uid,
      accountId: tx.accId,
      categoryId: tx.catId,
      installmentGroupId: tx.installmentGroupId ?? null,
      name: tx.name,
      amount: tx.amount,
      date: dateStr(tx.year, tx.month, tx.day),
      referenceMonth: refMonth(tx.year, tx.month),
      installmentNumber: tx.installmentNumber ?? null,
      totalInstallments: tx.totalInstallments ?? null,
    })
  }

  await db.insert(schema.transactions).values(allTxs)

  // ── investment types & investments ────────────────────────────────────────
  console.log('📈 Inserting investments…')

  const invTypes = await db
    .insert(schema.investmentTypes)
    .values([
      { userId: uid, name: 'Tesouro Selic', color: '#2d6e3e', bgColor: '#e8f5ec' },
      { userId: uid, name: 'CDB Inter', color: '#1e3e7a', bgColor: '#e6eef6' },
      { userId: uid, name: 'Ações', color: '#8a1e8a', bgColor: '#f6e4f6' },
    ])
    .returning()

  const invType = {
    tesouro: invTypes[0]!,
    cdb: invTypes[1]!,
    acoes: invTypes[2]!,
  }

  // Monthly investment amounts + yield
  const invData: {
    month: (typeof MONTHS)[0]
    typeId: string
    amount: string
    yield: string | null
  }[] = [
    // Tesouro Selic — R$ 500/mês, yield ~R$ 25-40
    ...MONTHS.map(({ year, month }, i) => ({
      month: { year, month },
      typeId: invType.tesouro.id,
      amount: '500.00',
      yield: ['28.40', '31.20', '29.80', '33.50', '30.10', '32.60'][i] ?? null,
    })),
    // CDB Inter — R$ 300/mês, yield ~R$ 15-25
    ...MONTHS.map(({ year, month }, i) => ({
      month: { year, month },
      typeId: invType.cdb.id,
      amount: '300.00',
      yield: ['16.80', '18.20', '17.50', '19.10', '16.40', '18.90'][i] ?? null,
    })),
    // Ações — R$ 200/mês, yield variável (pode ser negativo)
    ...MONTHS.map(({ year, month }, i) => ({
      month: { year, month },
      typeId: invType.acoes.id,
      amount: ['200.00', '200.00', '0.00', '200.00', '200.00', '200.00'][i]!,
      yield: ['-45.20', '62.30', '15.80', '-28.40', '88.50', '12.30'][i] ?? null,
    })),
  ]

  const invRows = invData.map(({ month, typeId, amount, yield: y }) => ({
    userId: uid,
    investmentTypeId: typeId,
    amount: amount === '0.00' ? null : amount,
    yieldAmount: y,
    referenceMonth: refMonth(month.year, month.month),
    excludeFromCashFlow: false as boolean,
  }))

  await db.insert(schema.investments).values(invRows)

  // ── goals ─────────────────────────────────────────────────────────────────
  console.log('🎯 Inserting goals…')

  const [goalEmergencia] = await db
    .insert(schema.goals)
    .values({
      userId: uid,
      name: 'Reserva de Emergência',
      targetAmount: '30000.00',
      targetDate: '2027-12-01',
      investmentTypeId: invType.tesouro.id,
    })
    .returning()

  const [goalViagem] = await db
    .insert(schema.goals)
    .values({
      userId: uid,
      name: 'Viagem Europa 2027',
      targetAmount: '15000.00',
      targetDate: '2027-06-01',
      investmentTypeId: null,
    })
    .returning()

  if (!goalEmergencia || !goalViagem) throw new Error('Failed to insert goals')

  // Link Tesouro Selic to goal
  await db
    .update(schema.investmentTypes)
    .set({ goalId: goalEmergencia.id })
    .where(eq(schema.investmentTypes.id, invType.tesouro.id))

  // Goal contributions (manual entries to track progress)
  const contributions: (typeof schema.goalContributions.$inferInsert)[] = MONTHS.map(
    ({ year, month }) => ({
      goalId: goalEmergencia.id,
      userId: uid,
      amount: '500.00',
      referenceMonth: refMonth(year, month),
      source: 'investment',
    })
  )

  contributions.push(
    {
      goalId: goalViagem.id,
      userId: uid,
      amount: '300.00',
      referenceMonth: refMonth(2026, 3),
      source: 'manual',
    },
    {
      goalId: goalViagem.id,
      userId: uid,
      amount: '300.00',
      referenceMonth: refMonth(2026, 4),
      source: 'manual',
    },
    {
      goalId: goalViagem.id,
      userId: uid,
      amount: '300.00',
      referenceMonth: refMonth(2026, 5),
      source: 'manual',
    }
  )
  await db.insert(schema.goalContributions).values(contributions)

  // ── people & debtor entries ───────────────────────────────────────────────
  console.log('👥 Inserting people and debtor entries…')

  const [personCarlos] = await db
    .insert(schema.people)
    .values({
      userId: uid,
      name: 'Carlos Mendes',
      phone: '(11) 99876-5432',
      notes: 'Amigo de faculdade',
      archived: false,
    })
    .returning()

  const [personAna] = await db
    .insert(schema.people)
    .values({
      userId: uid,
      name: 'Ana Lima',
      email: 'ana.lima@gmail.com',
      notes: 'Colega de trabalho',
      archived: false,
    })
    .returning()

  const [personRafael] = await db
    .insert(schema.people)
    .values({
      userId: uid,
      name: 'Rafael Costa',
      phone: '(21) 98765-4321',
      archived: false,
    })
    .returning()

  if (!personCarlos || !personAna || !personRafael) throw new Error('Failed to insert people')

  // Carlos deve R$ 500 (empréstimo Jan) — quitado em Mar
  const [chargeCarlos] = await db
    .insert(schema.debtorEntries)
    .values({
      userId: uid,
      personId: personCarlos.id,
      type: 'charge',
      amount: '500.00',
      description: 'Empréstimo — viagem ano novo',
      referenceMonth: refMonth(2026, 1),
      entryDate: dateStr(2026, 1, 10),
      dueDate: dateStr(2026, 3, 10),
      status: 'settled',
    })
    .returning()

  const [paymentCarlos] = await db
    .insert(schema.debtorEntries)
    .values({
      userId: uid,
      personId: personCarlos.id,
      type: 'payment',
      amount: '500.00',
      description: 'Pagamento empréstimo Jan',
      referenceMonth: refMonth(2026, 3),
      entryDate: dateStr(2026, 3, 8),
    })
    .returning()

  if (chargeCarlos && paymentCarlos) {
    await db
      .update(schema.debtorEntries)
      .set({ settledByPaymentId: paymentCarlos.id })
      .where(eq(schema.debtorEntries.id, chargeCarlos.id))
  }

  // Carlos ainda deve R$ 200 (conta bar dividida, aberto)
  await db.insert(schema.debtorEntries).values({
    userId: uid,
    personId: personCarlos.id,
    type: 'charge',
    amount: '200.00',
    description: 'Bar — conta dividida (Apr)',
    referenceMonth: refMonth(2026, 4),
    entryDate: dateStr(2026, 4, 19),
    status: 'open',
  })

  // Ana — você deve R$ 150 (dividiu conta de restaurante)
  const [adjustAna] = await db
    .insert(schema.debtorEntries)
    .values({
      userId: uid,
      personId: personAna.id,
      type: 'adjustment',
      amount: '150.00',
      description: 'Parte do restaurante que ela pagou por mim',
      referenceMonth: refMonth(2026, 2),
      entryDate: dateStr(2026, 2, 22),
    })
    .returning()

  // Pagamento à Ana em Mar
  if (adjustAna) {
    await db.insert(schema.debtorEntries).values({
      userId: uid,
      personId: personAna.id,
      type: 'payment',
      amount: '150.00',
      description: 'Devolução restaurante Fev',
      referenceMonth: refMonth(2026, 3),
      entryDate: dateStr(2026, 3, 5),
    })
  }

  // Rafael deve R$ 800 (conserto do carro), parcial quitação de R$ 400
  await db
    .insert(schema.debtorEntries)
    .values({
      userId: uid,
      personId: personRafael.id,
      type: 'charge',
      amount: '800.00',
      description: 'Adiantei conserto do carro dele',
      referenceMonth: refMonth(2026, 1),
      entryDate: dateStr(2026, 1, 20),
      dueDate: dateStr(2026, 4, 20),
      status: 'open',
    })
    .returning()

  await db.insert(schema.debtorEntries).values({
    userId: uid,
    personId: personRafael.id,
    type: 'payment',
    amount: '400.00',
    description: 'Pagamento parcial — conserto carro',
    referenceMonth: refMonth(2026, 3),
    entryDate: dateStr(2026, 3, 20),
  })

  // Rafael ainda deve R$ 400 (nova charge aberta)
  await db.insert(schema.debtorEntries).values({
    userId: uid,
    personId: personRafael.id,
    type: 'charge',
    amount: '400.00',
    description: 'Saldo restante — conserto carro',
    referenceMonth: refMonth(2026, 4),
    entryDate: dateStr(2026, 4, 1),
    dueDate: dateStr(2026, 6, 1),
    status: 'open',
  })

  console.log('✅ Seed completed successfully!')
  console.log('   Months: Dec/2025 → May/2026')
  console.log('   Income: ~R$ 6.500–7.700/mês')
  console.log('   Categories: 17 (2 groups)')
  console.log('   Payment accounts: 3')
  console.log('   Fixed expenses: 8 × 6 months = 48 rows')
  console.log('   Variable transactions: ~90 rows')
  console.log('   Installment groups: 2 (Notebook 12x, Viagem 6x)')
  console.log('   Investment types: 3 | Investment rows: 18')
  console.log('   Goals: 2 (Reserva Emergência + Viagem Europa)')
  console.log('   People: 3 | Debtor entries: 9')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
