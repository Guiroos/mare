// app/api/export/extrato/route.ts
import { auth } from '@/lib/auth'
import { sheetToCsv, toCsvResponse } from '@/lib/export/csv'
import { buildExtratoRows, writeExtratoXlsx } from '@/lib/export/extrato-xlsx'
import {
  EXPORT_ROW_LIMIT,
  slugifyForFilename,
  toXlsxResponse,
  tooManyRowsResponse,
} from '@/lib/export/xlsx'
import { collectHistoricoItems } from '@/lib/queries/historico'
import { parseHistoricoParams } from '@/lib/utils/historico-params'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const params = parseHistoricoParams(Object.fromEntries(searchParams))
  const isCsv = searchParams.get('format') === 'csv'

  const items = await collectHistoricoItems(session.user.id, params)
  if (items.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()

  const de = slugifyForFilename(params.de)
  const ate = slugifyForFilename(params.ate)
  const filename = `mare-extrato-${de}-a-${ate}`
  if (isCsv) return toCsvResponse(sheetToCsv(buildExtratoRows(items)), `${filename}.csv`)

  const buffer = await writeExtratoXlsx(items)
  return toXlsxResponse(buffer, `${filename}.xlsx`)
}
