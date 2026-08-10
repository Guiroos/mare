// __tests__/unit/export-devedores-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))
vi.mock('@/lib/queries/debtors', () => ({
  getAllDebtorEntries: vi.fn(),
  getPeopleWithBalances: vi.fn(),
  getPersonDebtDetails: vi.fn(),
}))

import { auth } from '@/lib/auth'
import {
  getAllDebtorEntries,
  getPeopleWithBalances,
  getPersonDebtDetails,
} from '@/lib/queries/debtors'
import { EXPORT_ROW_LIMIT } from '@/lib/export/xlsx'
import { GET } from '@/app/api/export/devedores/route'

type Person = Awaited<ReturnType<typeof getPeopleWithBalances>>[number]
type Entry = Awaited<ReturnType<typeof getAllDebtorEntries>>[number]

function people(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `person-${i}`,
    name: `Pessoa ${i}`,
    phone: null,
    balance: 10,
  })) as unknown as Person[]
}

function entries(count: number): Entry[] {
  return Array.from({ length: count }, () => ({
    personName: 'Pessoa 0',
    type: 'charge',
    amount: '10.00',
    description: 'Cobrança',
    referenceMonth: '2026-08-01',
    entryDate: '2026-08-01',
    status: 'open',
    notes: null,
  })) as unknown as Entry[]
}

describe('GET /api/export/devedores', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as unknown as Awaited<
      ReturnType<typeof auth>
    >)
    vi.mocked(getPersonDebtDetails).mockReset()
    vi.mocked(getPeopleWithBalances).mockReset()
    vi.mocked(getAllDebtorEntries).mockReset()
  })

  it('devolve 404 sem consultar o banco quando ?pessoa= não é um uuid válido', async () => {
    const req = new Request('http://localhost/api/export/devedores?pessoa=abc')
    const res = await GET(req)

    expect(res.status).toBe(404)
    expect(getPersonDebtDetails).not.toHaveBeenCalled()
  })

  it('consulta getPersonDebtDetails quando ?pessoa= é um uuid válido', async () => {
    vi.mocked(getPersonDebtDetails).mockResolvedValue(null)
    const validUuid = '11111111-1111-4111-8111-111111111111'
    const req = new Request(`http://localhost/api/export/devedores?pessoa=${validUuid}`)
    const res = await GET(req)

    expect(getPersonDebtDetails).toHaveBeenCalledWith('user-1', validUuid)
    expect(res.status).toBe(404)
  })

  // O CSV de Saldos tem uma linha por pessoa. Aferir o teto contra os lançamentos
  // recusaria um arquivo de dezenas de linhas — e a tela não oferece filtro para reduzir.
  it('exporta o CSV de saldos mesmo com lançamentos acima do teto', async () => {
    vi.mocked(getPeopleWithBalances).mockResolvedValue(people(3))
    vi.mocked(getAllDebtorEntries).mockResolvedValue(entries(EXPORT_ROW_LIMIT + 1))

    const req = new Request('http://localhost/api/export/devedores?format=csv&sheet=saldos')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('mare-devedores-saldos-')
    // Não deve nem buscar os lançamentos: esse arquivo não os usa.
    expect(getAllDebtorEntries).not.toHaveBeenCalled()
  })

  it('recusa o CSV de saldos quando são as próprias pessoas que passam do teto', async () => {
    vi.mocked(getPeopleWithBalances).mockResolvedValue(people(EXPORT_ROW_LIMIT + 1))

    const req = new Request('http://localhost/api/export/devedores?format=csv&sheet=saldos')
    const res = await GET(req)

    expect(res.status).toBe(413)
  })

  it('recusa o CSV de lançamentos acima do teto', async () => {
    vi.mocked(getAllDebtorEntries).mockResolvedValue(entries(EXPORT_ROW_LIMIT + 1))

    const req = new Request('http://localhost/api/export/devedores?format=csv')
    const res = await GET(req)

    expect(res.status).toBe(413)
  })
})
