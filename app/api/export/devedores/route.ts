// app/api/export/devedores/route.ts
import { auth } from '@/lib/auth'
import { sheetToCsv, toCsvResponse } from '@/lib/export/csv'
import {
  buildLancamentosRows,
  buildSaldosRows,
  writeDevedoresXlsx,
  writePessoaXlsx,
} from '@/lib/export/devedores-xlsx'
import {
  EXPORT_ROW_LIMIT,
  slugifyForFilename,
  toXlsxResponse,
  tooManyRowsResponse,
} from '@/lib/export/xlsx'
import {
  getAllDebtorEntries,
  getPeopleWithBalances,
  getPersonDebtDetails,
} from '@/lib/queries/debtors'
import { todayISOString } from '@/lib/utils/date'
import { uuidSchema } from '@/lib/validations/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const rawPersonId = searchParams.get('pessoa')
  const isCsv = searchParams.get('format') === 'csv'
  const hoje = todayISOString()

  if (rawPersonId) {
    const parsedPersonId = uuidSchema.safeParse(rawPersonId)
    if (!parsedPersonId.success) return new Response('Não encontrado', { status: 404 })

    // getPersonDebtDetails já filtra por userId: id de outro usuário devolve null.
    const details = await getPersonDebtDetails(userId, parsedPersonId.data)
    if (!details) return new Response('Não encontrado', { status: 404 })

    const entries = details.entries.map((e) => ({
      personName: details.person.name,
      type: e.type,
      amount: e.amount,
      description: e.description,
      referenceMonth: e.referenceMonth,
      entryDate: e.entryDate,
      status: e.status,
      notes: e.notes,
    }))

    const slug = slugifyForFilename(details.person.name)
    const filename = `mare-devedores-${slug}-${hoje}`
    if (isCsv) return toCsvResponse(sheetToCsv(buildLancamentosRows(entries)), `${filename}.csv`)

    const buffer = await writePessoaXlsx(entries)
    return toXlsxResponse(buffer, `${filename}.xlsx`)
  }

  // CSV é uma tabela só: cada aba do XLSX vira um arquivo separado, escolhido via ?sheet.
  // Cada formato afere o teto contra as linhas que ele próprio emite — Saldos tem uma
  // linha por pessoa, e reprová-lo pelo volume de lançamentos recusaria um arquivo
  // pequeno sem que o usuário tenha filtro para reduzi-lo.
  if (isCsv) {
    if (searchParams.get('sheet') === 'saldos') {
      const people = await getPeopleWithBalances(userId)
      if (people.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()
      return toCsvResponse(sheetToCsv(buildSaldosRows(people)), `mare-devedores-saldos-${hoje}.csv`)
    }

    const entries = await getAllDebtorEntries(userId)
    if (entries.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()
    return toCsvResponse(
      sheetToCsv(buildLancamentosRows(entries)),
      `mare-devedores-lancamentos-${hoje}.csv`
    )
  }

  // XLSX traz as duas abas no mesmo arquivo: o teto vale sobre os lançamentos, que
  // são a aba que cresce.
  const [people, entries] = await Promise.all([
    getPeopleWithBalances(userId),
    getAllDebtorEntries(userId),
  ])

  if (entries.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()

  const buffer = await writeDevedoresXlsx(people, entries)
  return toXlsxResponse(buffer, `mare-devedores-${hoje}.xlsx`)
}
