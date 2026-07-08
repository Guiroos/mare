# Leituras de página usam `neon-serverless` (WebSocket) em vez de `neon-http`

## Problema

`lib/db/index.ts` expõe um único cliente Drizzle baseado em `Pool` de
`@neondatabase/serverless` (driver WebSocket, `drizzle-orm/neon-serverless`). Esse driver é
obrigatório para `db.transaction()`, mas todas as **queries de leitura** das páginas (Server
Components de dashboard, panorama, histórico, etc.) também passam por ele.

O driver WebSocket faz um handshake de conexão a cada cold start da Serverless Function. O
driver HTTP (`drizzle-orm/neon-http`) faz cada query como um único round-trip HTTP, sem
handshake persistente — mais rápido para o padrão de leitura one-shot que domina o TTFB das
páginas. As leituras não usam `db.transaction()`, então não precisam do WebSocket.

## Contexto — por que surgiu

Investigação de TTFB alto (1.88s no Vercel Analytics). A causa raiz principal era
**região**: Neon em `sa-east-1` (São Paulo) e Serverless Functions no default `iad1`
(Washington), com o dashboard empilhando ~3 ondas sequenciais de queries cruzando o
Atlântico. Isso foi resolvido fixando `"regions": ["gru1"]` no `vercel.json`.

O overhead do handshake WebSocket é o **segundo fator**, de menor magnitude, e só vale a
pena atacar se o TTFB continuar alto após a co-localização de região.

## Ocorrências conhecidas

| Arquivo | Contexto |
| ------- | -------- |
| `lib/db/index.ts` | Cliente único `neon-serverless` usado tanto por queries (`lib/queries/`) quanto por actions com `db.transaction()` (`lib/actions/`) |

## Por que não resolvemos agora

- A co-localização de região (`gru1`) já elimina a maior parte da latência; medir antes de
  otimizar o driver evita trabalho especulativo.
- Introduzir um segundo cliente adiciona superfície de configuração e o risco de uma leitura
  acabar no cliente errado.

## Critério para revisitar

- Quando, **após** confirmar as functions em `gru1`, o TTFB ainda ficar acima de ~700ms e os
  logs de `Server-Timing`/`console.time` mostrarem que o custo está em conexão/query, não em
  compute.

## Implementação proposta

- Adicionar um segundo export em `lib/db/index.ts`, ex. `dbRead`, baseado em
  `drizzle-orm/neon-http` (`neon()` de `@neondatabase/serverless`), compartilhando o mesmo
  `schema`.
- Migrar as queries de leitura (`lib/queries/*`) para `dbRead`; manter `db` (WebSocket/`Pool`)
  nas actions que usam `db.transaction()`.
- Cuidado documentado em `.claude/db.md`: `drizzle-orm/neon-http` **não** suporta
  `db.transaction()` — nenhuma action pode usar `dbRead`.
- Verificar que nenhuma rota declara `export const runtime = 'edge'` (o driver HTTP funciona
  em edge, mas o WebSocket não; a decisão de runtime não deve depender do cliente).
