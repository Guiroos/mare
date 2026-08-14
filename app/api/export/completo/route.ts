// app/api/export/completo/route.ts
import { auth } from '@/lib/auth'
import { sheetToCsv } from '@/lib/export/csv'
import { collectFullExport } from '@/lib/export/full/collect'
import { writeFullXlsx } from '@/lib/export/full/xlsx'
import { toXlsxResponse } from '@/lib/export/xlsx'
import { createZip, toZipResponse } from '@/lib/export/zip'
import { todayISOString } from '@/lib/utils/date'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const isCsv = new URL(req.url).searchParams.get('format') === 'csv'
  const sheets = await collectFullExport(session.user.id)
  const filename = `mare-completo-${todayISOString()}`

  if (isCsv) {
    const buffer = createZip(
      sheets.map((sheet) => ({
        name: `${sheet.filename}.csv`,
        content: sheetToCsv(sheet.data),
      }))
    )
    return toZipResponse(buffer, `${filename}.zip`)
  }

  return toXlsxResponse(await writeFullXlsx(sheets), `${filename}.xlsx`)
}
