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
import { getPersonDebtDetails } from '@/lib/queries/debtors'
import { GET } from '@/app/api/export/devedores/route'

describe('GET /api/export/devedores', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as unknown as Awaited<
      ReturnType<typeof auth>
    >)
    vi.mocked(getPersonDebtDetails).mockReset()
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
})
