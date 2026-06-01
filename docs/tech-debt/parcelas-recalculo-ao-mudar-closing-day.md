# Parcelas futuras não são recalculadas ao mudar `closingDay`

## Problema

Quando o usuário altera o `closingDay` de um cartão de crédito em `/contas`, as parcelas
futuras já criadas para aquela conta continuam com os `referenceMonth` e `date` calculados
com o `closingDay` antigo. Não há nenhuma lógica de recálculo disparada pela action de
update da conta.

**Exemplo:** conta com `closingDay = 5`, compra parcelada em 3x criada com esse fechamento.
Usuário muda para `closingDay = 16`. As parcelas futuras continuam apontando para os meses
calculados com fechamento 5, que agora estão errados.

## Por que não resolvemos agora

O caso de uso é raro (usuário raramente muda o `closingDay` de um cartão existente) e
o impacto é silencioso — não quebra nada, apenas exibe parcelas no mês errado. A
correção manual via script já existe (`scripts/fix-installment-dates.ts --dry-run` +
aplicação).

## Solução planejada

Na action `updatePaymentAccount` (ou equivalente em `lib/actions/`), após persistir o
novo `closingDay`, disparar o recálculo das parcelas futuras vinculadas àquela conta:

1. Buscar todos os `installmentGroups` com `accountId = id` que tenham parcelas com
   `referenceMonth > currentReferenceMonth`
2. Para cada grupo, recalcular `date` e `referenceMonth` de cada parcela futura usando
   `calcBaseReferenceMonth` e `calcInstallmentDate` de `lib/utils/date.ts` — mesma lógica
   de `scripts/fix-installment-dates.ts`, mas escopo restrito à conta alterada
3. Executar as atualizações em `db.transaction`
4. `revalidatePath('/parcelas')` e `revalidatePath('/dashboard')`

## Critério para revisitar

- Quando houver relato de usuário confuso com parcelas no mês errado após trocar o
  fechamento do cartão.
- Ou quando a tela `/contas` receber uma revisão de UX e for natural incluir esse
  comportamento.
