import { config } from 'dotenv'
import { join } from 'path'

config({ path: join(process.cwd(), '.env.local'), override: false })

const REQUIRED_NEON_VARS = ['NEON_API_KEY', 'NEON_PROJECT_ID', 'NEON_PARENT_BRANCH_ID'] as const

const missing = REQUIRED_NEON_VARS.filter((v) => !process.env[v])

if (missing.length > 0) {
  throw new Error(
    `[integration] Variáveis de ambiente Neon ausentes: ${missing.join(', ')}.\n` +
      `Adicione-as ao .env.local antes de rodar npm run test:integration.\n` +
      `NEON_PARENT_BRANCH_ID deve apontar para o branch dev, nunca para produção.`
  )
}
