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
| `row-actions.tsx`    | `RowActions`                    | Kebab menu (⋮). Props: `onEdit?` `onDelete?` (omitir remove o item do menu); `additionalActions?: Array<{label, icon?, onClick, variant?}>` renderizadas antes do separador Editar/Excluir; `triggerClassName` para override do hover em fundo colorido; requer `group` na div pai |
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
- `uppercase tracking-wide` sobrescreve o `letter-spacing` configurado nos tokens tipográficos — `text-label` e `text-caption` já têm tracking próprio no `tailwind.config.ts`; não acumular `uppercase tracking-wide` sobre eles; se o visual "caixa alta espaçada" for recorrente, criar token específico
- Seletores de filho `[&>svg]:h-N [&>svg]:w-N [&>svg]:text-*` para estilizar SVGs filhos sem exigir que callers os estilizem — aceitos como funcionais (mesmo padrão de `[&>span]:line-clamp-1`); não são violação da Regra 3
- `SelectTrigger` em contextos compactos (toolbar, pill): usar `h-7`/`h-8` + `w-auto` via `className` — nunca `h-auto`, que não é altura válida de controle interativo (Regra 3)
- `SelectContent` do DS já encapsula `SelectPrimitive.Portal` internamente — não adicionar `Portal` separado ao usar o DS `Select`; props `sideOffset` e `align` passam via `...props` para `SelectPrimitive.Content`
- Sub-grid de espaçamento permitido termina em `p-2.5` (10px): `p-3.5` (14px) é inválido — não está no grid de 4px nem na lista de sub-grid `p-0.5`/`p-1.5`/`p-2.5`
- `Chip` aceita `className` para adaptar shape em toolbars: `rounded-md border text-caption h-8` transforma o pill padrão em chip retangular compacto; use `Chip` quando todos os itens têm a mesma cor active — para cores active variáveis por item, usar raw `<button>`
- `transition` do Tailwind já inclui `border-color` e `box-shadow` no conjunto padrão — `transition-[border-color,box-shadow]` é valor arbitrário proibido; usar `transition` diretamente
- `DrawerContent` não tem padding horizontal próprio: ao exibir formulário dentro de `Drawer`, envolver o conteúdo com `<div className="px-4 pb-6">` (horizontal padding + bottom padding)
- Itens destrutivos em `DropdownMenu`: usar `text-negative` (vermelho vibrante, herda para ícones via `currentColor`) — não `text-negative-text`, que é para texto sobre fundo vermelho
- Gráficos Recharts com estado vazio: usar `h-56` (224px) no container do estado vazio e `height={224}` no `ResponsiveContainer` para alinhar sem valor arbitrário; `borderRadius` em `contentStyle` do `Tooltip` deve seguir tokens: `'10px'` = `rounded-md`, `'16px'` = `rounded-lg`
- Listas de multi-select com checkboxes: usar `<input type="checkbox" className="accent-accent">` dentro de `<Label>` do DS (nunca `<label>` HTML — viola Regra 4 mesmo sem ser um campo `<Field>`); o DS não tem primitivo `Checkbox`; `<Switch>` não substitui checkbox em multi-select (Switch é toggle binário único)
- Qualquer `tracking-*` acumulado sobre token tipográfico é proibido — a regra de `tracking-wide` aplica-se igualmente a `tracking-widest`, `tracking-wider` etc.; todos sobrescrevem o letter-spacing configurado no token; se o visual "caixa alta espaçada" for recorrente, criar token específico
- Alturas de elementos fixos (navbars, headers com `position: fixed/sticky`) devem usar classe Tailwind no grid de 4px, não `style={{ height: 'Xpx' }}` — a Regra 3 (zero valores arbitrários) aplica-se também a `style={}`, não só a `className`
