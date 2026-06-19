# Vitest incompatível com Vite 7 (ESM) — RESOLVIDO

## Problema original

O Vitest 3.2.4 não conseguia carregar o `vitest.config.ts` quando o Vite 7 está instalado,
porque o `vitest/dist/config.cjs` tentava fazer `require()` de
`vite/dist/node/index.js` — que no Vite 7 é um módulo ESM puro.

O Vite 7.x foi introduzido como dependência transitiva do Next.js 16.

## Solução aplicada

**Problema raiz em camadas:**

1. `vitest/dist/config.cjs` usa `require()` internamente para carregar dependências (ex: `std-env`).
2. No Vitest 4.1.9, `std-env@4.1.0` é ESM-only — o `require()` falha.
3. Vite 7 carrega `vitest.config.ts` em modo CJS quando não há `"type": "module"` no projeto.

**Fix:**

- Renomear os arquivos de config para `.mts`: força Vite 7 a usar `import()` ESM ao
  carregar a config, evitando o `require()` de módulos ESM.
- `__dirname` não existe em ESM — substituído por `import.meta.dirname` (Node >=21.2).
- `vi.useFakeTimers()` sem parâmetros no Vitest 4.x faz fake de `setTimeout`/`setImmediate`
  internos do Vitest, travando `afterEach`. Corrigido com `{ toFake: ['Date'] }` nos testes
  que precisam somente de controle de `Date`.

**Pacotes atualizados (versões fixas):**

| Pacote | Antes | Depois |
| ------ | ----- | ------ |
| `vitest` | 3.2.4 | 4.1.9 |
| `@vitest/coverage-v8` | 3.2.4 | 4.1.9 |
| `@vitejs/plugin-react` | 4.7.0 | 5.2.0 |

**Arquivos alterados:**

- `vitest.config.ts` → `vitest.config.mts`
- `vitest.integration.config.ts` → `vitest.integration.config.mts`
- `package.json`: script `test:integration` aponta para `.mts`; versões fixas das devDeps acima
- `__tests__/unit/date.test.ts`: todos os `vi.useFakeTimers()` → `vi.useFakeTimers({ toFake: ['Date'] })`

## Status

Resolvido. `npm test` passa com 303 testes. Hook de pre-push do Husky funciona normalmente.
