// lib/export/xlsx.ts
import type { Cell, Row } from 'write-excel-file/node'
import { parseDate } from '@/lib/utils/date'

/**
 * Teto de linhas por exportação. Acima disso a rota recusa em vez de truncar:
 * um arquivo truncado em silêncio seria usado para conferir totais e daria
 * números errados sem nenhum sinal.
 */
export const EXPORT_ROW_LIMIT = 20_000

export function textCell(value: string | null): Cell {
  return { value: value ?? '', type: String }
}

export function dateCell(dateStr: string): Cell {
  return { value: parseDate(dateStr), type: Date, format: 'dd/mm/yyyy' }
}

export function moneyCell(value: number): Cell {
  return { value, type: Number, format: '#,##0.00' }
}

export function headerRow(labels: string[]): Row {
  return labels.map((value) => ({ value, type: String, fontWeight: 'bold' }))
}

/** Normaliza um nome para uso seguro dentro de Content-Disposition. */
export function slugifyForFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function toXlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function tooManyRowsResponse(): Response {
  return new Response('Período muito grande para exportar — reduza o intervalo ou os filtros.', {
    status: 413,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
