import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['__tests__/integration/env-setup.ts'],
    include: ['__tests__/integration/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 4,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
})
