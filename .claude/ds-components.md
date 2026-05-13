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

---

## Gotchas de tokens e utilitários

- `twMerge` (em `lib/utils/cn.ts`) está configurado com `extendTailwindMerge` para reconhecer os tokens customizados de tipografia — sobreposições como `text-display` sobre `text-body` funcionam corretamente
- Modificador de opacidade `/N` (ex: `text-negative-text/60`) **não funciona** com CSS vars opacas (`oklch(...)`) — usar `opacity-N` no elemento em vez disso
- `bg-bg-input` não é gerado pelo Tailwind JIT (conflito com token shadcn `input:` na raiz do `colors`); a classe está declarada manualmente em `globals.css` via `@layer utilities` — não remover
- `SelectTrigger` (Radix) renderiza como `<button>`, que tem background cinza nativo do browser — sempre incluir `bg-bg-input` explicitamente no trigger
- Qualquer componente que aceita e forwarda `className`: **sempre** via `cn()` de `lib/utils/cn` — nunca template string ou concatenação manual; exceção: `CurrencyInput`/`NumericInput` usam `array.filter(Boolean).join(' ')` com `inputBase`/`inputErrorCls` (padrão legado aceito)
- `tabular-nums` obrigatório em qualquer elemento que exiba valor numérico em contexto de comparação (contagens, percentuais, totais — não só valores monetários)
- `[grid-template-columns:...]` é valor arbitrário proibido — usar `flex` com `flex-1`/`flex-shrink-0` para layouts de 3-4 colunas com largura variável
- `ds-reviewer`: ao implementar múltiplos componentes novos numa sessão, executar **uma vez ao final** com todos os arquivos — não após cada arquivo individualmente
- Hero com 4 colunas + sidebar visível: usar `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` — `lg:grid-cols-4` a 1024px deixa ~148px por coluna, insuficiente; no `xl:` (1280px) cada coluna tem ~250px; valor principal com `text-hero xl:text-h1 2xl:text-hero`
- Botões de ação em headers de seção/card: envolver o label em `<span className="hidden sm:inline">` para icon-only abaixo de 640px; posicionar o botão no header com `lg:hidden` (não solto após a lista)
- Accordion header com badge + valor à direita: nome deve usar `<span className="block truncate">` para não quebrar linha; badge de status vai na linha do subtítulo (substituindo barra de progresso) — não inline com o nome
- Labels de seção em `flex justify-between`: adicionar `whitespace-nowrap` no label esquerdo; texto secundário verboso (ex: "· ordenados por valor") em `<span className="hidden md:inline">` para sumir em mobile
- `select-none` em componentes de navegação (`BottomNav`, `Sidebar`) previne seleção de texto acidental ao clicar em itens de nav
