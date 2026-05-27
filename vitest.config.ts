import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/unit/**/*.test.ts', '__tests__/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/utils/**', 'lib/validations/**'],
      exclude: ['**/*.d.ts'],
      // Thresholds por arquivo — proteção de regressão onde há cobertura real.
      // Não usar threshold global enquanto houver arquivos com 0% no escopo:
      // a média é grande demais para detectar regressões pontuais.
      //
      // Padrão de crescimento:
      //   1. Escrever testes para um arquivo até cobertura significativa (>= 80%).
      //   2. Adicionar entrada em thresholds.perFile abaixo.
      //   3. Threshold protege a cobertura conquistada — nunca definir abaixo
      //      do percentual atual do arquivo.
      thresholds: {
        perFile: true,
        // lib/utils/currency.ts — lógica financeira central; 100% mantido.
        'lib/utils/currency.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/utils/date.ts — helpers de data; 100% atingido.
        'lib/utils/date.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/utils.ts — schemas base e formatZodErrors; 100% atingido.
        'lib/validations/utils.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/transactions.ts — schemas de form e action; 100% atingido.
        'lib/validations/transactions.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/utils/cn.ts — merge de classes Tailwind com tokens DS; 100% atingido.
        'lib/utils/cn.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/utils/color.ts — deriveBgColor e constantes; 100% atingido.
        'lib/utils/color.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/categories.ts — schemas de grupo, categoria e conta; 100% atingido.
        'lib/validations/categories.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/debtors.ts — schemas de pessoa e lançamentos; 100% atingido.
        'lib/validations/debtors.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/fatura.ts — schema de pagamento de fatura; 100% atingido.
        'lib/validations/fatura.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/goals.ts — schemas de meta e contribuição; 100% atingido.
        'lib/validations/goals.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/investments.ts — schemas de investimento e resgate; 100% atingido.
        'lib/validations/investments.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // lib/validations/settings.ts — schema de creditMode; 100% atingido.
        'lib/validations/settings.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
