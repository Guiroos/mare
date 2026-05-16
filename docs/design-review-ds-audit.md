# Design Review — Auditoria DS Maré

> Gerado em: 2026-05-13
> Última atualização: 2026-05-13 (P7 concluída — auditoria completa)
> Escopo: `components/ui/`, `components/`, `app/(app)/`
> Método: revisão sistemática pelas 6 regras do DS Maré

---

## Sumário

| Regra                                               | Violações originais | Resolvidas | Pendentes |
| --------------------------------------------------- | ------------------- | ---------- | --------- |
| Regra 2 — Compostos usam primitivos / `cn()`        | 6                   | 6          | 0         |
| Regra 3 — Tokens nomeados, zero valores arbitrários | 24                  | 24         | 0         |
| Regra 5 — Modais responsivos Dialog + Drawer        | 8                   | 8          | 0         |
| **Total**                                           | **38**              | **38**     | **0**     |

---

## Prioridade 1 — Erros nos primitivos do DS ✓ concluída

Erros aqui propagam para todo o app. Corrigir primeiro.

### `components/ui/badge.tsx`

- [x] **R3** — `gap-[5px]` → `gap-1`
- [x] **R3** — `h-[7px] w-[7px]` (dot decorativo) → `h-1.5 w-1.5`
- [x] **R2** — `className` forwarded via template string → `cn()`

### `components/ui/drawer.tsx`

- [x] **R3** — `rounded-t-[10px]` → `rounded-t-md`
- [x] **R3** — `w-[100px]` (handle) → `w-24`
- [x] **R3** — `DrawerTitle` usa `text-lg font-semibold leading-none tracking-tight` → `text-h3`

---

## Prioridade 2 — Páginas com múltiplos tokens errados ✓ concluída

### `app/(app)/panorama/page.tsx`

- [x] **R3** — `text-green-600` → `text-positive-text`
- [x] **R3** — `text-red-500` → `text-negative-text`
- [x] **R3** — `text-blue-600` → `text-accent-text`
- [x] **R3** — `text-sm` → `text-small`
- [x] **R3** — `text-xs` → `text-caption`
- [x] **R3** — `tabular-nums` adicionado em todos os `formatCurrency(...)` da tabela
- [x] **R3** — `bg-bg-subtle/50` → `bg-bg-muted` (gotcha: `/N` não funciona com CSS vars oklch)
- [x] **R3** — `hover:bg-bg-subtle/30` → `hover:bg-bg-muted`

### `app/(app)/metas/page.tsx`

- [x] **R3** — `text-sm font-semibold uppercase tracking-wide` em `<h2>` → `text-label font-semibold` (sem `uppercase tracking-wide` — override não documentado dos tokens tipográficos)
- [x] **R3** — `text-xs` → `text-caption` (linhas ~90, 100, 116, 123, 125)
- [x] **R3** — `text-sm` → `text-small`
- [x] **R3** — `uppercase tracking-wide` removido do label "Aportes" (mesmo motivo)
- [x] **R3** — `bg-green-600` no `indicatorClassName` do `Progress` → `bg-positive`
- [x] **R3** — `tabular-nums` adicionado nos valores de progresso e percentual

---

## Prioridade 3 — `text-xs` / `text-sm` espalhados (busca+replace) ✓ concluída

Padrão: `text-xs` → `text-caption`, `text-sm` → `text-small`.

- [x] **R3** `components/layout/BottomNav.tsx` — `text-sm font-medium` nos links do menu Dialog
- [x] **R3** `components/dashboard/FixedExpenseEditDialog.tsx` — `text-sm text-text-secondary` no FormLoader
- [x] **R3** `components/dashboard/TransactionEditDialog.tsx` — `text-sm text-text-secondary` no FormLoader
- [x] **R3** `components/parcelas/InstallmentGroupEditDialog.tsx` — `text-sm text-text-secondary` no FormLoader
- [x] **R3** `components/investimentos/WithdrawalEditButton.tsx` — `text-xs text-text-secondary`
- [x] **R3** `components/configuracao-mes/CopyFixedExpensesButton.tsx` — `text-xs text-text-secondary`
- [x] **R3** `components/configuracao-mes/CopyPrevMonthButton.tsx` — `text-xs text-text-secondary`

> Dica: `grep -rn 'text-xs\|text-sm' components/ app/\(app\)/ --include="*.tsx"` para mapear todas as ocorrências antes de corrigir.

---

## Prioridade 4 — Outros valores arbitrários isolados ✓ concluída

### `components/layout/BottomNav.tsx`

- [x] **R3** — `duration-[160ms]` → `duration-base` (200ms) — linhas 62, 68, 75, 150, 157, 163
- [x] **R3** — `text-[10.5px] tracking-[-0.005em]` (label de nav) → `text-caption`
- [x] **R3** — `gap-[3px]` → `gap-1` (4px)
- [x] **R3** — `rounded-[14px]` (pill ativa de nav) → `rounded-lg` (16px)

### `components/dashboard/PendencyBanner.tsx`

- [x] **R3** — `rounded-[12px]` → `rounded-lg` (16px)
- [x] **R3** — `text-[13px]` → `text-small` (14px)
- [x] **R3** — `mt-[1px]` → `mt-px`

### `components/dashboard/SummaryCards.tsx`

- [x] **R3** — `bg-negative/80` → `bg-negative opacity-80` (modificador `/N` não funciona com CSS vars oklch)
- [x] **R3** — `duration-500` → `duration-base`

### `components/investimentos/InvestmentTypeAccordion.tsx`

- [x] **R3** — `min-w-[60px]` → `min-w-16` (64px)

### `app/(app)/registro/RegistroPageClient.tsx`

- [x] **R3** — `lg:grid-cols-[1fr_280px]` → `flex gap-6` com `flex-1` no form e `w-72 flex-shrink-0` no preview (gotcha: `[grid-template-columns:...]` é proibido)

---

## Prioridade 5 — `cn()` nos primitivos DS ✓ concluída

- [x] **R2** `components/ui/summary-card.tsx` — `className` forwarded via template string → `cn()`
- [x] **R2** `components/ui/empty-state.tsx` — idem
- [x] **R2** `components/ui/budget-bar.tsx` — idem; também: `transition-[width]` → `transition-all`

---

## Prioridade 6 — Componentes compostos ignorando primitivos ✓ concluída

### `components/dashboard/MonthSelector.tsx`

- [x] **R2** — `@radix-ui/react-select` direto → `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` do DS; `className` override para estilo pill compacto (`h-7 rounded-full`)
- [x] **R2** — setas de navegação `<button>` → `<Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">`
- [x] **R2** — botão "Mês atual" `<button>` → `<Button variant="primary" size="xs" className="rounded-full">`
- [x] **R3** — `h-auto` no `SelectTrigger` → `h-7`
- [x] **R3** — `px-3.5` no pill do mês → `px-4`

### `components/parcelas/ParcelasToolbar.tsx`

- [x] **R2** — `<select>` HTML nativo → `Select` do DS com `className="h-8 w-auto px-3 text-caption font-medium"` no trigger
- [x] **R2** — chips de filtro `<button>` → `<Chip active={isActive} className="h-8 gap-1.5 rounded-md border text-caption">`
- [x] **R3** — badge de contagem (`count`) sem `tabular-nums` → adicionado

---

## Prioridade 7 — Modais sem padrão responsivo (Dialog + Drawer) ✓ concluída

Todos os componentes abaixo usam apenas `<Dialog>` sem fallback `<Drawer>` para mobile. Padrão de referência: `DeleteButton` e `InvestmentEntryDialog`.

- [x] **R5** `components/investimentos/WithdrawalEditButton.tsx`
- [x] **R5** `components/investimentos/WithdrawalDialog.tsx`
- [x] **R5** `components/metas/GoalDialog.tsx`
- [x] **R5** `components/metas/ContributionDialog.tsx`
- [x] **R5** `components/metas/ContributionEditButton.tsx`
- [x] **R5** `components/categorias/CategoryDialog.tsx`
- [x] **R5** `components/categorias/GroupDialog.tsx`
- [x] **R5** `components/configuracao-mes/BudgetOverrideDialog.tsx`

> Padrão de implementação:
>
> ```tsx
> const isDesktop = useMediaQuery('(min-width: 1024px)')
> return isDesktop ? (
>   <Dialog open={open} onOpenChange={onOpenChange}>
>     ...
>   </Dialog>
> ) : (
>   <Drawer open={open} onOpenChange={onOpenChange}>
>     ...
>   </Drawer>
> )
> ```

---

## Não são violações (registrado para clareza)

- `select.tsx`: `h-[var(--radix-select-trigger-height)]` e `[&>span]:line-clamp-1` — valores funcionais do Radix sem alternativa em token, aceitos.
- `empty-state.tsx`: `[&>svg]:h-7 [&>svg]:w-7 [&>svg]:text-text-tertiary` — seletor de filho sem equivalente Tailwind; aceito (mesmo padrão de `[&>span]:line-clamp-1`).
- `Sidebar.tsx`: `style={{}}` com `linear-gradient` e `oklch(...)` no logo/avatar — painéis brand, exceção documentada na Regra 3.
- Focus ring `shadow-[0_0_0_3px_var(--ring-accent)]` e `shadow-[0_0_0_3px_var(--ring-negative)]` — únicos valores arbitrários permitidos explicitamente.
- `CurrencyInput`/`NumericInput`: uso de `array.filter(Boolean).join(' ')` com `inputBase`/`inputErrorCls` — padrão legado aceito nesses dois arquivos.
