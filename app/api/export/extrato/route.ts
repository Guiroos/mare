// app/api/export/extrato/route.ts
import { auth } from '@/lib/auth'
import { writeExtratoXlsx } from '@/lib/export/extrato-xlsx'
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

  const items = await collectHistoricoItems(session.user.id, params)
  if (items.length > EXPORT_ROW_LIMIT) return tooManyRowsResponse()

  const buffer = await writeExtratoXlsx(items)
  const de = slugifyForFilename(params.de)
  const ate = slugifyForFilename(params.ate)
  return toXlsxResponse(buffer, `mare-extrato-${de}-a-${ate}.xlsx`)
}
