// lib/export/zip.ts
import { zipSync } from 'fflate'

export interface ZipEntry {
  name: string
  content: string
}

/**
 * Monta um ZIP em memória a partir de arquivos de texto.
 *
 * O `fflate` já está na árvore por baixo do write-excel-file (um .xlsx É um zip);
 * declará-lo como dependência direta evita reimplementar container binário à mão
 * e dá o unzipSync usado no teste de round-trip.
 */
export function createZip(entries: ZipEntry[]): Buffer {
  const encoder = new TextEncoder()
  const files: Record<string, Uint8Array> = {}

  for (const entry of entries) {
    files[entry.name] = encoder.encode(entry.content)
  }

  return Buffer.from(zipSync(files, { level: 6 }))
}

export function toZipResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
