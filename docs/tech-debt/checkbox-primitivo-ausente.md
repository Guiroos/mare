# Primitivo `Checkbox` ausente do DS

## Problema

O Design System Maré não tem um componente `Checkbox` em `components/ui/`. A tela de
vinculação de cobranças em `DebtPaymentDialog` usa `<input type="checkbox">` nativo com
`<label>` HTML envolvente — padrão funcional, mas fora da hierarquia de camadas do DS.

## Ocorrências conhecidas

| Arquivo | Contexto |
| ------- | -------- |
| `components/devedores/DebtPaymentDialog.tsx` | Lista de cobranças abertas para vinculação ao pagamento |

## Por que não resolvemos agora

O contexto de uso é muito específico (lista de checkboxes dentro de um form colapsável) e o
visual nativo é suficiente. Criar o primitivo sem um segundo caso de uso real levaria a uma
abstração prematura.

## Critério para revisitar

- Quando aparecer um segundo caso de uso de checkbox no projeto.
- Implementação: criar `components/ui/checkbox.tsx` (Camada 1), seguindo o padrão de
  `switch.tsx` — componente controlado com props `checked`, `onChange`, `label`, `disabled`.
  Atualizar `ds-components.md` com o novo primitivo.
