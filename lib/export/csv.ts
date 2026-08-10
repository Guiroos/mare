// lib/export/csv.ts
import type { Cell, Row, SheetData } from 'write-excel-file/node'

/**
 * BOM UTF-8: sem ele o Excel abre o arquivo em latin-1 e corrompe acentos.
 * Delimitador ';': no Excel pt-BR a vírgula é separador decimal, então CSV com
 * vírgula quebra as colunas — ';' é o padrão que o Excel pt-BR reconhece.
 */
const BOM = '﻿'
const DELIMITER = ';'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Reaproveita as células do write-excel-file (mesmo shape do XLSX): datas viram
 * dd/mm/yyyy, números usam vírgula decimal para o Excel pt-BR ler como número.
 */
function formatCell(cell: Cell): string {
  // Cell é uma união larga do write-excel-file; nossas células sempre têm `value`.
  const value = (cell as { value?: string | number | Date | null }).value
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
  }
  if (typeof value === 'number') return value.toFixed(2).replace('.', ',')
  return String(value)
}

function escapeField(field: string): string {
  return /[";\n\r]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

function rowToCsv(row: Row): string {
  return row.map((cell) => (cell ? escapeField(formatCell(cell)) : '')).join(DELIMITER)
}

export function sheetToCsv(data: SheetData): string {
  return BOM + data.map(rowToCsv).join('\r\n')
}

export function toCsvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
