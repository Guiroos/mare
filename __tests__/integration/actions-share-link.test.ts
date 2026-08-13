import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import { createUser, createPerson, createCharge } from './helpers/factories'
import { hashShareToken } from '@/lib/utils/share-token'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ host: 'localhost:3000' })),
}))
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }))
vi.mock('@/lib/auth/ownership', () => ({
  assertOwnsPerson: vi.fn(),
  assertOwnsDebtEntry: vi.fn(),
}))

const FOREIGN_UUID = '00000000-0000-0000-0000-000000000000'

neonTestingSetup()

let db: TestDb
let userId: string
let personId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `sharelink-${Date.now()}`))
  ;({ id: personId } = await createPerson(db, userId, 'Namorada'))
  await createCharge(db, userId, personId, { amount: '80.00', description: 'Cinema' })

  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
  const { assertOwnsPerson } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsPerson).mockResolvedValue(undefined)
})

afterEach(async () => {
  // mockRejectedValueOnce não consumido contamina o teste seguinte
  const { requireUserId } = await import('@/lib/auth/require-user')
  vi.mocked(requireUserId).mockResolvedValue(userId)
  const { assertOwnsPerson } = await import('@/lib/auth/ownership')
  vi.mocked(assertOwnsPerson).mockResolvedValue(undefined)
})

describe('generateShareLink', () => {
  it('grava o hash e o token cifrado, e devolve a URL', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { url } = await generateShareLink(personId)

    const token = url.split('/e/')[1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // origem vem do request, não do SITE_URL fixo — link gerado em dev aponta
    // para o host de dev, onde o token realmente existe
    expect(url).toBe(`http://localhost:3000/e/${token}`)

    const row = await db.query.people.findFirst({ where: eq(schema.people.id, personId) })
    expect(row!.shareTokenHash).toBe(hashShareToken(token))
    // o token não fica legível no banco
    expect(row!.shareToken).toMatch(/^enc:/)
    expect(row!.shareToken).not.toContain(token)
  })

  it('o token gravado resolve o extrato daquela pessoa', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')

    const { url } = await generateShareLink(personId)
    const token = url.split('/e/')[1]

    const statement = await getSharedDebtStatement(hashShareToken(token))
    expect(statement!.personName).toBe('Namorada')
    expect(statement!.charges.map((c) => c.description)).toContain('Cinema')
  })

  it('gerar de novo invalida o link anterior', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')

    const primeiro = (await generateShareLink(personId)).url.split('/e/')[1]
    const segundo = (await generateShareLink(personId)).url.split('/e/')[1]

    expect(segundo).not.toBe(primeiro)
    expect(await getSharedDebtStatement(hashShareToken(primeiro))).toBeNull()
    expect(await getSharedDebtStatement(hashShareToken(segundo))).not.toBeNull()
  })

  it('revalida a página da pessoa', async () => {
    const { revalidatePath } = await import('next/cache')
    const { generateShareLink } = await import('@/lib/actions/debtors')

    vi.mocked(revalidatePath).mockClear()
    await generateShareLink(personId)

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/devedores/${personId}`)
  })

  it('checa ownership com os IDs corretos', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    const { generateShareLink } = await import('@/lib/actions/debtors')

    vi.mocked(assertOwnsPerson).mockClear()
    await generateShareLink(personId)

    expect(vi.mocked(assertOwnsPerson)).toHaveBeenCalledWith(userId, personId)
  })

  it('rejeita pessoa de outro usuário', async () => {
    const { assertOwnsPerson } = await import('@/lib/auth/ownership')
    vi.mocked(assertOwnsPerson).mockRejectedValueOnce(new Error('Forbidden'))

    const { generateShareLink } = await import('@/lib/actions/debtors')
    await expect(generateShareLink(FOREIGN_UUID)).rejects.toThrow('Forbidden')
  })

  it('rejeita id que não é UUID antes de tocar no banco', async () => {
    const { generateShareLink } = await import('@/lib/actions/debtors')
    await expect(generateShareLink('nao-e-uuid')).rejects.toThrow()
  })
})

describe('archivePerson', () => {
  it('derruba o link público junto', async () => {
    // pessoa própria: arquivar a do beforeAll invalidaria o link dos outros testes
    const { id: outroId } = await createPerson(db, userId, 'Ex-colega')
    await createCharge(db, userId, outroId, { amount: '10.00', description: 'Almoço' })

    const { generateShareLink, archivePerson } = await import('@/lib/actions/debtors')
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')

    const token = (await generateShareLink(outroId)).url.split('/e/')[1]
    expect(await getSharedDebtStatement(hashShareToken(token))).not.toBeNull()

    await archivePerson(outroId)

    expect(await getSharedDebtStatement(hashShareToken(token))).toBeNull()
    const row = await db.query.people.findFirst({ where: eq(schema.people.id, outroId) })
    expect(row!.shareTokenHash).toBeNull()
    expect(row!.shareToken).toBeNull()
  })

  it('nega o extrato de pessoa arquivada com hash ainda gravado', async () => {
    // cobre quem foi arquivado antes de `archivePerson` passar a zerar o hash
    const { id: legadoId } = await createPerson(db, userId, 'Arquivado legado')
    await createCharge(db, userId, legadoId, { amount: '10.00', description: 'Café' })

    const { generateShareLink } = await import('@/lib/actions/debtors')
    const { getSharedDebtStatement } = await import('@/lib/queries/debtors')

    const token = (await generateShareLink(legadoId)).url.split('/e/')[1]
    await db.update(schema.people).set({ archived: true }).where(eq(schema.people.id, legadoId))

    expect(await getSharedDebtStatement(hashShareToken(token))).toBeNull()
  })
})
