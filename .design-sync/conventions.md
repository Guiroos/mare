# Maré — como construir com este design system

App de finanças pessoais em pt-BR. Textos de UI em português; valores em BRL (`R$ 1.234,56`).

## Setup

**Não há provider.** Os componentes são autônomos — nenhum `ThemeProvider`, nenhum contexto
obrigatório. Basta importar e usar.

Só duas coisas são globais:

- **`styles.css`** define os tokens (custom properties em `:root`) e todas as utilities. Sem ele
  os componentes renderizam sem estilo.
- **Tema escuro** é `class="dark"` num ancestral (o `<html>`). Os tokens são redeclarados no
  bloco `.dark`, então **nenhum componente precisa de variante escura** — quem usa nomes de
  token ganha dark mode de graça. Cor literal (`bg-white`, `#0f172a`, `text-gray-500`) quebra o
  tema escuro: não use.

## Idioma de estilo: Tailwind com tokens nomeados

Toda a estilização é classe utilitária do Tailwind. **Use sempre o token nomeado, nunca o valor
arbitrário** (`bg-[#0369a1]`, `text-[13px]`, `p-[14px]` estão errados — existe token para isso).

| Família | Classes |
| --- | --- |
| Fundo | `bg-bg-base` (fundo da página) `bg-bg-surface` (cards) `bg-bg-input` `bg-bg-subtle` `bg-bg-muted` |
| Texto | `text-text-primary` `text-text-secondary` `text-text-tertiary` `text-text-inverse` |
| Semântica | `accent` (azul-oceano, ação primária) · `positive` (entradas) · `negative` (saídas) · `warning`. Cada uma tem `-hover`, `-subtle` (fundo) e `-text` (texto sobre o fundo `-subtle`): `bg-positive-subtle text-positive-text` |
| Borda | `border-border` `border-border-strong` |
| Tipografia | `text-hero` `text-display` `text-h1` `text-h2` `text-h3` `text-body-lg` `text-body` `text-small` `text-caption` `text-label` `text-amount` |
| Radius | `rounded-sm`(6) `rounded-md`(10) `rounded-lg`(16) `rounded-xl`(20) `rounded-full` |
| Sombra | `shadow-sm` `shadow-md` `shadow-lg` |
| Transição | `duration-fast`(120ms) `duration-base`(200ms) |

`text-negative` é vermelho sobre fundo neutro; `text-negative-text` é **só** para texto dentro de
um fundo `bg-negative-subtle`. O sufixo `-text` sempre significa "sobre fundo colorido".

Regras que o DS trata como obrigatórias:

- **Todo valor numérico comparável leva `tabular-nums`** — valores, percentuais, contagens.
- **Formulário usa `<Field>`**, nunca `<div>` + `<Label>` na mão: o `Field` já traz label, hint,
  erro e o asterisco de `required`.
- Alturas de controle interativo: `h-7` `h-8` `h-9` `h-11` `h-12` `h-14`. Nunca `h-auto`.
- Espaçamento no grid de 4px (`p-2` `p-3` `p-4` `p-5` `p-6`), com `p-0.5` `p-1.5` `p-2.5` como
  sub-grid permitido. `p-3.5` não existe.

## Composição

- Página: `<PageLayout>` (espaçamento vertical) → `<PageHeader>` → `<Section>`s. Cabeçalho com
  ação: `<div className="flex items-start justify-between gap-4">` em volta de `PageHeader` +
  botão.
- Valores em destaque: `SummaryCard` (trio entradas/saídas/saldo) e `BalanceCard` (herói com
  fundo accent).
- Listas de lançamento: `TxList` + `TxGroupHeader` + `TxItem` / `FixedExpenseItem` + `ListFooter`.
- Ação por linha: `RowActions` (exige `group` na div pai) ou `DeleteButton` — nunca um botão de
  excluir improvisado.
- Responsivo de modal: `Dialog` no desktop (`lg+`) e `Drawer` no mobile. `Select` do Radix **não**
  popula `FormData` — espelhe o valor num `<input type="hidden">`.

## Onde está a verdade

- `_ds/<folder>/styles.css` e o que ele importa — a lista real de tokens e utilities.
- `guidelines/` — o inventário completo do DS, camada por camada, com os gotchas de cada
  componente.
- `components/<grupo>/<Nome>/<Nome>.prompt.md` e `.d.ts` — props e uso de cada componente.

## Exemplo

```jsx
<Section title="Agosto" action={<Button size="xs" variant="ghost">Ver tudo</Button>}>
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <SummaryCard variant="positive" label="Entradas" amount="R$ 5.200,00" footer="1 lançamento" />
    <SummaryCard variant="negative" label="Saídas" amount="R$ 3.140,00" footer="12 lançamentos" />
    <SummaryCard variant="balance" label="Saldo" amount="R$ 2.060,00" />
  </div>
  <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-bg-surface p-5 shadow-sm">
    <span className="text-body text-text-primary">Fatura Nubank</span>
    <span className="text-body font-semibold tabular-nums text-negative">− R$ 1.842,30</span>
  </div>
</Section>
```
