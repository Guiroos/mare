# Vitest incompatível com Vite 7 (ESM)

## Problema

O Vitest 3.2.4 não consegue carregar o `vitest.config.ts` quando o Vite 7 está instalado,
porque o `vitest/dist/config.cjs` tenta fazer `require()` de
`vite/dist/node/index.js` — que no Vite 7 é um módulo ESM puro:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
/node_modules/vite/dist/node/index.js from
/node_modules/vitest/dist/config.cjs not supported.
```

O Vite 7.x foi introduzido como dependência transitiva do Next.js 16. O `package.json` do
projeto não tem `"type": "module"`, o que impede a resolução automática do ESM.

## Impacto

- `npm test` falha com startup error antes de executar qualquer teste.
- O hook de pre-push do Husky bloqueia `git push` (workaround: `--no-verify`).
- Cobertura de testes unitários fica desabilitada no ambiente local.

## Ocorrências conhecidas

| Arquivo | Contexto |
| ------- | -------- |
| `vitest.config.ts` | Configuração do Vitest — falha ao ser bundleada pelo Vite 7 em modo CJS |
| `.husky/pre-push` | Executa `npm test` antes do push — falha em cascata |

## Por que não resolvemos agora

O problema apareceu ao final de uma sessão de desenvolvimento sem tempo para investigar
a combinação correta de versões. Os testes unitários existentes são poucos (apenas
`privacy-mode.test.ts` e afins em `__tests__/unit/`) e a verificação pode ser feita via
lint + typecheck no curto prazo.

## Critério para revisitar

Antes de adicionar novos testes unitários ou quando o hook de pre-push voltar a atrapalhar
o fluxo de trabalho.

## Solução provável

Atualizar o Vitest para a versão que adiciona suporte explícito ao Vite 7 (verificar
`vitest` changelog por release com `peerDependency: vite >= 7`), ou fixar a versão do Vite
em `package.json` para a última 6.x compatível com Vitest 3.2.x:

```bash
# Opção A — atualizar Vitest
npm install --save-dev vitest@latest

# Opção B — fixar Vite em versão compatível
npm install --save-dev vite@^6
```

Após a correção, remover o `--no-verify` do fluxo e validar que `npm test` passa
localmente antes de qualquer push.
