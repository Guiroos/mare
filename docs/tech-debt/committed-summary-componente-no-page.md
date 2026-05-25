# `CommittedSummary` definido no mesmo arquivo que o page

## Problema

O componente `CommittedSummary` está declarado no final de
`app/(app)/configuracao-mes/page.tsx`, junto com o componente de página. Isso viola a
Regra 1 do DS Maré: cada componente independente deve ter seu próprio arquivo.

## Ocorrências conhecidas

| Arquivo | Contexto |
| ------- | -------- |
| `app/(app)/configuracao-mes/page.tsx` | `CommittedSummary` declarado na linha ~185, após o export default da page |

## Por que não resolvemos agora

O componente é usado exclusivamente neste page e a extração não traz benefício imediato
de reuso. Mover agora seria refatoração cosmética sem impacto funcional.

## Critério para revisitar

- Quando `CommittedSummary` precisar ser reutilizado em outro contexto.
- Implementação: mover para `components/configuracao-mes/CommittedSummary.tsx`, importar
  no page. Sem mudança de interface ou comportamento.
