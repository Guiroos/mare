# Padronização das ações de header

**Data:** 2026-07-28
**Branch:** `feat/exportacao-xlsx`

## Problema

Os botões de ação de "criar" não seguem um padrão visual nem de posicionamento
consistente entre as telas. `investimentos` estabelece um bom padrão (título à
esquerda, botões à direita, `md` + `primary`/`outline`), mas `metas`,
`categorias` e `contas` escondem a ação de criar dentro de uma `Section`, com
estilo compacto (`sm`/`outline`/ícone `h-3.5`). `devedores` já usa o header, mas
sem o split mobile e com o `ExportButton` menor que o botão vizinho. O dashboard
usa um botão vago ("Nova") em vez de dizer o que cria.

## Padrão canônico de "ação de header"

### Posicionamento (referência: `investimentos`)

```tsx
<div className="flex items-start justify-between gap-4">
  <PageHeader title="…" description="…" />
  <div className="hidden items-center gap-2 lg:flex">
    {/* secundário (outline) e depois primário (filled) */}
  </div>
</div>
```

### Estilo do botão no header

- `size="md"`
- ícone (`Plus` ou ícone de domínio) `h-4 w-4`
- `className="gap-2"`
- ação principal: `variant="primary"`
- ação secundária (quando houver): `variant="outline"`
- label sempre descritivo: `"+ <entidade>"` (nunca só "Nova")

### Comportamento mobile (replicar `investimentos`)

- O bloco de ações do header é `hidden lg:flex` — some abaixo de `lg`.
- A ação de criar permanece dentro da `Section`/`EmptyState` no estilo compacto
  atual (`sm`/`outline`), envolvida em `lg:hidden` para não duplicar no desktop.

## Mudanças de componente

### `GoalDialog`, `GroupDialog`, `AccountDialog`

Adicionar props opcionais ao trigger de criar, espelhando o `triggerSize` que o
`InvestmentTypeDialog` já expõe:

- `triggerSize?: ButtonSize` — default `'sm'`
- `triggerVariant?: ButtonVariant` — default `'outline'`

O trigger de criar passa a:

```tsx
<Button
  size={triggerSize}
  variant={triggerVariant}
  className={triggerSize === 'md' ? 'gap-2' : 'gap-1.5'}
  onClick={() => setOpen(true)}
>
  <Plus className="h-4 w-4" />
  {label}
</Button>
```

Defaults preservam o uso atual (dentro da `Section`, mobile). O header passa
`triggerSize="md" triggerVariant="primary"`.

### `ExportButton`

Adicionar `size?: ButtonSize` (default `'sm'`). Header de `devedores` passa
`size="md"` para casar com o `PersonDialog` vizinho.

### `DashboardFAB`

- Label: `"Nova"` → `"Lançamento"`.
- Estilo: `variant="primary" size="sm"`, ícone `Plus h-4 w-4`, `gap-2`
  (continua `hidden lg:flex`; mobile usa o `+` do bottom nav).

## Mudanças por página

1. **metas** — adicionar bloco de header (`hidden lg:flex`) com `GoalDialog`
   `triggerSize="md" triggerVariant="primary"`. Manter o `GoalDialog` na seção
   "Suas metas", agora envolto em `lg:hidden`.
2. **categorias** — adicionar bloco de header com `GroupDialog` md/primary. A
   `action` da `Section` passa a `<div className="lg:hidden"><GroupDialog … /></div>`.
3. **contas** — idem com `AccountDialog` md/primary; `action` da `Section` em
   `lg:hidden`.
4. **devedores** — envolver as ações existentes em `hidden lg:flex`
   (`ExportButton size="md"` + `PersonDialog` primário md). Adicionar contraparte
   mobile (`lg:hidden`) do `PersonDialog` na `Section`/lista de pessoas.
5. **dashboard** — **sem** header próprio (mantém `MonthSelector`). Só alinhar o
   estilo dos botões do slot `action`: `ExportButton` (outline sm) + `DashboardFAB`
   agora "Lançamento" (primary sm).

## Fora de escopo

- `historico` e `panorama` já seguem o posicionamento no header com uma única
  ação `outline`; não precisam de mudança nesta rodada.
- `parcelas`, `registro`, `configuracao-mes` são read-only ou o próprio form —
  sem ação de criar no header.

## Verificação

- `npm run lint && npm run format:check && npm run typecheck && npm test`
- Validação visual (Playwright MCP) em desktop e mobile de cada página alterada:
  botão no header em `lg+`, ação compacta na seção em mobile, sem duplicação.
