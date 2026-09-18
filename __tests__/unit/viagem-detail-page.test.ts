// __tests__/unit/viagem-detail-page.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))
vi.mock('@/lib/queries/trips', () => ({
  getTripDetail: vi.fn(),
}))
vi.mock('@/lib/queries/goals', () => ({
  getGoalsWithProgress: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { getTripDetail } from '@/lib/queries/trips'
import { getGoalsWithProgress } from '@/lib/queries/goals'
import ViagemDetalhePage from '@/app/(app)/viagens/[id]/page'

describe('ViagemDetalhePage', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as unknown as Awaited<
      ReturnType<typeof auth>
    >)
    vi.mocked(getTripDetail).mockReset()
    vi.mocked(getGoalsWithProgress).mockReset()
    vi.mocked(getGoalsWithProgress).mockResolvedValue([])
  })

  it('devolve notFound sem consultar o banco quando o segmento não é um uuid', async () => {
    await expect(ViagemDetalhePage({ params: Promise.resolve({ id: 'abc' }) })).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404'
    )
    expect(getTripDetail).not.toHaveBeenCalled()
    expect(getGoalsWithProgress).not.toHaveBeenCalled()
  })

  it('consulta getTripDetail e devolve notFound quando a viagem não é do usuário', async () => {
    vi.mocked(getTripDetail).mockResolvedValue(null)
    const validUuid = '11111111-1111-4111-8111-111111111111'

    await expect(ViagemDetalhePage({ params: Promise.resolve({ id: validUuid }) })).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404'
    )
    expect(getTripDetail).toHaveBeenCalledWith('user-1', validUuid)
  })
})
