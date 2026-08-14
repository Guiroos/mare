// lib/export/full/xlsx.ts
import writeXlsxFile from 'write-excel-file/node'
import type { ExportSheet } from './collect'

export function writeFullXlsx(sheets: ExportSheet[]): Promise<Buffer> {
  return writeXlsxFile(
    sheets.map((sheet) => ({
      sheet: sheet.name,
      stickyRowsCount: 1,
      columns: sheet.widths.map((width) => ({ width })),
      data: sheet.data,
    })),
    { fontFamily: 'Calibri', fontSize: 11 }
  ).toBuffer()
}
