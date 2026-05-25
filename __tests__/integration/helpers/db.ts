import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@/lib/db/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>>

export function createTestDb(): TestDb {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  return drizzle(pool, { schema })
}
