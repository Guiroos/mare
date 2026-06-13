# DB & Drizzle

## Schema

- Indexes: terceiro parâmetro é função de array — `pgTable('t', cols, (t) => [index('name').on(t.col1)])`
- `uniqueIndex` no mesmo array; action usa `.onConflictDoUpdate({ target: [...], set: {...} })` — elimina `existingId ? UPDATE : INSERT`; retorna 500 em runtime se o index não existir no banco — rodar `db:migrate` antes de testar mutations
- FK self-referente: importar `AnyPgColumn` de `drizzle-orm/pg-core` **sem** modifier `type` (ESLint falso positivo) + função lazy: `col.references((): AnyPgColumn => table.id, { onDelete: 'set null' })`
- `drizzle-orm/neon-http` não suporta `db.transaction()` — usar `drizzle-orm/neon-serverless` com `Pool` de `@neondatabase/serverless` (já instalado); verificar que nenhuma rota usa `export const runtime = 'edge'` antes de trocar

## Queries

- `inArray(col, ids)` gera SQL inválido (`IN ()`) se `ids` vazio — sempre guardar com `if (ids.length > 0)`
- `findFirst` dentro de `db.transaction` retorna `null` silenciosamente — verificar null e lançar erro explícito; nunca `?.` quando o dado é obrigatório para o passo seguinte
- Condições `OR IS NULL`: usar `or(eq(col, val), isNull(col))` de `drizzle-orm` — não template `sql`
- Mutações em múltiplas tabelas: `db.transaction(async (tx) => { ... })` com `tx` no lugar de `db` dentro do callback
- Tipo de retorno sem export explícito: `export type X = Awaited<ReturnType<typeof fn>>[number]` logo após a função — mantém tipos sincronizados quando a query muda de shape
- `import { type X }` causa falso positivo ESLint (max-warnings 0) — importar sem modifier `type`
- Seletor de anos: `sql<number>\`EXTRACT(YEAR FROM ${col})::int\`` com `selectDistinct`; dedup com `new Set()`; fallback `[currentYear()]`
- `investmentWithdrawals.amount` é valor líquido (bruto − imposto); saldo de investimento deve somar bruto: `coalesce(sum(amount + coalesce(taxAmount, 0)), 0)`

## Migrations

- Após `db:generate`: rodar `npx prettier --write lib/db/migrations/meta/` — pre-push hook rejeita formatação do Drizzle Kit
- Ao adicionar `uniqueIndex` em tabela existente: inserir `DELETE ... WHERE id NOT IN (SELECT DISTINCT ON (col1, col2) id FROM "tabela" ORDER BY col1, col2, id)` **antes** do `CREATE UNIQUE INDEX` — no-op se não houver duplicatas
- Ao adicionar coluna de status em tabela existente: `db:generate` não cria backfill — adicionar `UPDATE "tabela" SET "col" = 'valor' WHERE "condição"` manualmente após o último `statement-breakpoint`; backfills com IDs de produção não vão na migration — aplicar via Neon console

## Scripts

- Scripts em `scripts/` usam `config({ path: '.env.local' })` de `dotenv` — `import 'dotenv/config'` carrega `.env` inexistente e o script roda sem `DATABASE_URL`
