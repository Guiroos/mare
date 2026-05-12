# DS Maré — Inventário de Componentes

> Fonte única de verdade. Referenciado por `CLAUDE.md` (via `@`) e lido pelo agente `ds-reviewer` no início de cada revisão. Ao adicionar um componente a `components/ui/`, atualize **apenas este arquivo**.

---

## Hierarquia de camadas

Um componente que pertence a uma camada mais alta não pode "pular" uma camada inferior para usar HTML cru.

### Camada 1 — Primitivos
Sem dependências de outros componentes do DS.

`Label` `Input` `Textarea` `Badge` `Card` `Chip` `Button` `Switch` `Separator` `Progress`

### Camada 2 — Compostos
Importam e usam primitivos da Camada 1.

- `Field` → usa `<Label>`
- `CurrencyInput` → compartilha `inputBase` e `inputErrorCls` de `input.tsx`
- `Segment` `BudgetBar` `EmptyState` `SummaryCard` `BalanceCard` `Section` `PageHeader` `PageLayout` → compostos sem dependência de primitivos externos

### Camada 3 — Modal / Complexo
Radix UI + primitivos.

- `Select` → Radix Select com composição completa
- `Dialog` → Radix Dialog
- `Drawer` → vaul + Radix
- `DeleteButton` → `<Button>` + `<Dialog>` + `<Drawer>` (responsivo)
- `RowActions` → kebab menu com `<Dialog>`/`<Drawer>` interno
- `TxList` / `TxGroupHeader` / `TxItem` / `FixedExpenseItem` / `ListFooter` → sistema de lista complexo

---

## Tabela de inventário

| Arquivo              | Componente(s)                   | Props / Uso                                                                       |
| -------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `button.tsx`         | `Button`                        | Variantes: `primary` `secondary` `outline` `ghost` `danger` `positive` `surface`; Tamanhos: `lg` `md` `sm` `xs` `icon` |
| `badge.tsx`          | `Badge`                         | Variantes: `positive` `negative` `accent` `warning` `muted`                      |
| `chip.tsx`           | `Chip`                          | Toggle com prop `active`                                                         |
| `input.tsx`          | `Input`                         | Prop `error` disponível; exporta `inputBase` e `inputErrorCls`                   |
| `textarea.tsx`       | `Textarea`                      | Prop `error` disponível                                                          |
| `label.tsx`          | `Label`                         | Padrão: `text-caption font-medium text-text-secondary`                           |
| `field.tsx`          | `Field`                         | Props: `label` `hint` `error` `required` — envolve qualquer campo de formulário  |
| `select.tsx`         | `Select` + primitivos Radix     | Mesmo height que Input (`h-12`)                                                  |
| `currency-input.tsx` | `CurrencyInput`                 | Prop `error` disponível                                                          |
| `numeric-input.tsx`  | `NumericInput`                  | Igual ao CurrencyInput mas exibe só o número (sem `R$`) — usar em hero cards com prefixo separado |
| `switch.tsx`         | `Switch`                        | Props: `label` `checked` `onChange` `disabled` — para toggles booleanos          |
| `card.tsx`           | `Card`                          | Prop `padding`: `none` `sm` `md` `lg`; superfície com borda + shadow-sm          |
| `separator.tsx`      | `Separator`                     | Radix; prop `orientation`: `horizontal` (default) / `vertical`                   |
| `progress.tsx`       | `Progress`                      | Props: `value` `max` `indicatorClassName`                                        |
| `budget-bar.tsx`     | `BudgetBar`                     | Props: `current` `target` `label` `tone` (`ok`/`warn`/`over`/`accent`) `hint`    |
| `segment.tsx`        | `Segment`                       | Props: `options` `value` `onChange`; cada opção aceita `activeClassName` para cor ativa por item |
| `summary-card.tsx`   | `SummaryCard`                   | Props: `variant` (`balance`/`positive`/`negative`) `label` `amount` `footer` `icon` |
| `balance-card.tsx`   | `BalanceCard`                   | Props: `label` `amount` `income` `expense` — card de destaque com fundo accent   |
| `empty-state.tsx`    | `EmptyState`                    | Props: `icon` `title` `description` `action` `boxed`                             |
| `section.tsx`        | `Section`                       | Props: `title` `action` — wrapper de seção com heading padronizado               |
| `page-header.tsx`    | `PageHeader`                    | Props: `title` `description` — cabeçalho de página                               |
| `page-layout.tsx`    | `PageLayout`                    | Wrapper com `space-y-8` para layout de página                                    |
| `delete-button.tsx`  | `DeleteButton`                  | Confirmação inline responsiva. **Nunca** criar botão de delete ad-hoc            |
| `row-actions.tsx`    | `RowActions`                    | Kebab menu (⋮) com Editar + Excluir. Última coluna de listas, após o valor; `triggerClassName` para override do hover do kebab em fundo colorido |
| `dialog.tsx`         | `Dialog` + sub-componentes      | Radix Dialog — usar em desktop (≥1024px); combinar com Drawer para responsivo    |
| `drawer.tsx`         | `Drawer` + sub-componentes      | vaul Drawer — usar em mobile (<1024px); combinar com Dialog para responsivo      |
| `tx-list.tsx`        | `TxList` `TxGroupHeader` `TxItem` `FixedExpenseItem` `ListFooter` | Sistema de lista de transações |
