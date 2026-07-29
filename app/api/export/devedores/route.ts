// app/api/export/devedores/route.ts
import { auth } from '@/lib/auth'
import { writeDevedoresXlsx, writePessoaXlsx } from '@/lib/export/devedores-xlsx'
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

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id
  const personId = new URL(req.url).searchParams.get('pessoa')
  const hoje = todayISOString()

  if (personId) {
    // getPersonDebtDetails já filtra por userId: id de outro usuário devolve null.
    const details = await getPersonDebtDetails(userId, personId)
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

    const buffer = await writePessoaXlsx(entries)
    const slug = slugifyForFilename(details.person.name)
    return toXlsxResponse(buffer, `mare-devedores-${slug}-${hoje}.xlsx`)
  }

  const [people, entries] = await Promise.all([
    getPeopleWithBalances(userId),
    getAllDebtorEntries(userId),
  ])

  if (entries.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()

  const buffer = await writeDevedoresXlsx(people, entries)
  return toXlsxResponse(buffer, `mare-devedores-${hoje}.xlsx`)
}
