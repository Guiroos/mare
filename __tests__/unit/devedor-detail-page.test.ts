// __tests__/unit/devedor-detail-page.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))
vi.mock('@/lib/queries/debtors', () => ({
  getPersonDebtDetails: vi.fn(),
  getTransactionsForDebtLink: vi.fn(),
  getOpenChargesForPerson: vi.fn(),
}))
vi.mock('@/lib/queries/settings', () => ({
  getUserPixKey: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { getPersonDebtDetails } from '@/lib/queries/debtors'
import DevedorDetailPage from '@/app/(app)/devedores/[id]/page'

describe('DevedorDetailPage', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as unknown as Awaited<
      ReturnType<typeof auth>
    >)
    vi.mocked(getPersonDebtDetails).mockReset()
  })

  it('devolve notFound sem consultar o banco quando o segmento não é um uuid', async () => {
    await expect(DevedorDetailPage({ params: Promise.resolve({ id: 'abc' }) })).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404'
    )
    expect(getPersonDebtDetails).not.toHaveBeenCalled()
  })

  it('consulta getPersonDebtDetails quando o segmento é um uuid válido', async () => {
    vi.mocked(getPersonDebtDetails).mockResolvedValue(null)
    const validUuid = '11111111-1111-4111-8111-111111111111'

    await expect(DevedorDetailPage({ params: Promise.resolve({ id: validUuid }) })).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404'
    )
    expect(getPersonDebtDetails).toHaveBeenCalledWith('user-1', validUuid)
  })
})
