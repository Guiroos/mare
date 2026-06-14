# Number() direto em vez de toAmount() — varredura e correção

**Status: resolvido em 2026-06-14**

## Problema

O padrão documentado no projeto é usar `toAmount(val)` de `lib/utils/currency.ts`
ao converter campos `decimal` do Drizzle (que retornam como `string`). Vários
arquivos usavam `Number()` diretamente, quebrando a convenção.

Funcionalmente são equivalentes (`toAmount` é apenas `Number(value ?? 0)`), mas a
convenção existe para centralizar a conversão — se no futuro `toAmount` mudar para
usar uma lib de precisão decimal (ex: `Decimal.js`), todos os pontos serão
atualizados automaticamente.

## Ocorrências corrigidas

| Arquivo | Padrão substituído |
| ------- | ------------------ |
| `lib/queries/panorama.ts` | `Number(t.amount)` |
| `lib/queries/goals.ts` | `Number(goal.targetAmount)`, `Number(s?.totalAmount ?? 0)`, `Number(s?.totalYield ?? 0)`, `Number(w?.totalWithdrawn ?? 0)`, `Number(i.amount ?? 0)`, `Number(i.yieldAmount ?? 0)`, `Number(c.amount)` (×3) |
| `lib/queries/parcelas.ts` | `Number(group.totalAmount)`, `Number(t.amount)` |
| `lib/queries/investments.ts` | `Number(r.amount)` (resgates), `Number(inv.amount ?? 0)` (×2), `Number(inv.yieldAmount ?? 0)`, `Number(wd.amount)`, `Number(wd.taxAmount ?? 0)` |
| `lib/actions/investments.ts` | `Number(capitalRow?.total ?? 0)` (×2), `Number(amountResult[0]?.totalAmount ?? 0)`, `Number(amountResult[0]?.totalYield ?? 0)`, `Number(withdrawalResult[0]?.totalWithdrawn ?? 0)` |

## Ocorrências mantidas intencionalmente

Os padrões abaixo **não** foram substituídos porque preservam `null` no tipo de
retorno (`number | null`) — `toAmount` sempre retorna `number` e não pode ser usado
aqui sem perder informação de tipo:

| Arquivo | Padrão | Motivo |
| ------- | ------ | ------ |
| `lib/queries/investments.ts` | `e.amount !== null ? Number(e.amount) : null` (×2) | retorno `number \| null` intencional |
| `lib/queries/investments.ts` | `r.amount !== null ? Number(r.amount) : null` (×2) | idem |
| `lib/queries/investments.ts` | `r.taxAmount !== null ? Number(r.taxAmount) : null` | idem |

Também não foram alterados:

| Arquivo | Padrão | Motivo |
| ------- | ------ | ------ |
| `lib/queries/admin.ts` | `Number(row.count)` (×2) | contagem SQL (`COUNT`), não campo monetário |

## Critério para revisitar

Se `toAmount` for alterado para suportar `number | null` como retorno, as
ocorrências mantidas acima poderiam ser unificadas.
