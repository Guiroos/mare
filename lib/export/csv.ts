// lib/export/csv.ts
import type { Cell, Row, SheetData } from 'write-excel-file/node'

/**
 * BOM UTF-8: sem ele o Excel abre o arquivo em latin-1 e corrompe acentos.
 * Delimitador ';': no Excel pt-BR a vírgula é separador decimal, então CSV com
 * vírgula quebra as colunas — ';' é o padrão que o Excel pt-BR reconhece.
 */
const BOM = '﻿'
const DELIMITER = ';'

/**
 * Excel e LibreOffice avaliam como fórmula toda célula que comece com um destes
 * caracteres. Como descrição de lançamento e nome de pessoa são texto livre do
 * usuário, um campo `=HYPERLINK(...)` executaria ao abrir o arquivo. O XLSX não
 * tem esse problema — lá as células saem com `type: String`, que força texto.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/**
 * Strings como "1/12" (coluna Parcela) o Excel converte para data no import do
 * CSV — "1/12" vira 01/dez. Aspas não impedem a coerção. As colunas que são
 * data de verdade não passam por aqui: saem pelo ramo `Date` do formatCell.
 */
const COERCED_TO_DATE = /^\d{1,4}[/-]\d{1,4}([/-]\d{1,4})?$/

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Prefixo "'" é o marcador de texto literal que Excel e LibreOffice honram no
 * import: a célula fica como escrita, sem virar fórmula nem data.
 */
function forceText(text: string): string {
  return FORMULA_TRIGGER.test(text) || COERCED_TO_DATE.test(text) ? `'${text}` : text
}

/**
 * Reaproveita as células do write-excel-file (mesmo shape do XLSX): datas viram
 * dd/mm/yyyy, números usam vírgula decimal para o Excel pt-BR ler como número.
 *
 * Só o ramo de string passa por forceText — valor negativo é `number` e sai pelo
 * ramo numérico, então "-123,40" continua somável em vez de virar texto.
 */
function formatCell(cell: Cell): string {
  // Cell é uma união larga do write-excel-file; nossas células sempre têm `value`.
  const value = (cell as { value?: string | number | Date | null }).value
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
  }
  if (typeof value === 'number') return value.toFixed(2).replace('.', ',')
  return forceText(String(value))
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
