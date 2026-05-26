import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { neonTestingSetup } from './setup'
import { createTestDb, type TestDb } from './helpers/db'
import {
  createUser,
  createGoal,
  createGoalContribution,
  createInvestmentType,
} from './helpers/factories'

neonTestingSetup()

let db: TestDb
let userId: string

beforeAll(async () => {
  db = createTestDb()
  ;({ id: userId } = await createUser(db, `goals-${Date.now()}`))
})

describe('goalContributions — onDelete: cascade', () => {
  it('deletar goal apaga todas as contribuições vinculadas', async () => {
    const goal = await createGoal(db, userId, { name: 'Meta Cascade' })

    await createGoalContribution(db, userId, goal.id, { referenceMonth: '2025-01-01' })
    await createGoalContribution(db, userId, goal.id, { referenceMonth: '2025-02-01' })
    await createGoalContribution(db, userId, goal.id, { referenceMonth: '2025-03-01' })

    const before = await db.query.goalContributions.findMany({
      where: eq(schema.goalContributions.goalId, goal.id),
    })
    expect(before).toHaveLength(3)

    await db.delete(schema.goals).where(eq(schema.goals.id, goal.id))

    const after = await db.query.goalContributions.findMany({
      where: eq(schema.goalContributions.goalId, goal.id),
    })
    expect(after).toHaveLength(0)
  })

  it('deletar goal não afeta contribuições de outros goals', async () => {
    const goalA = await createGoal(db, userId, { name: 'Meta A' })
    const goalB = await createGoal(db, userId, { name: 'Meta B' })

    await createGoalContribution(db, userId, goalA.id)
    const contribB = await createGoalContribution(db, userId, goalB.id)

    await db.delete(schema.goals).where(eq(schema.goals.id, goalA.id))

    const surviving = await db.query.goalContributions.findFirst({
      where: eq(schema.goalContributions.id, contribB.id),
    })
    expect(surviving).toBeDefined()
  })
})

describe('investmentTypes.goalId — ON DELETE SET NULL (teste cruzado)', () => {
  it('deletar goal nulifica goalId em investmentTypes sem deletar o tipo', async () => {
    const goal = await createGoal(db, userId, { name: 'Meta para Tipo' })
    const type = await createInvestmentType(db, userId, {
      name: 'Tipo vinculado',
      goalId: goal.id,
    })

    const before = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })
    expect(before?.goalId).toBe(goal.id)

    await db.delete(schema.goals).where(eq(schema.goals.id, goal.id))

    const after = await db.query.investmentTypes.findFirst({
      where: eq(schema.investmentTypes.id, type.id),
    })
    expect(after).toBeDefined()
    expect(after?.goalId).toBeNull()
  })
})
