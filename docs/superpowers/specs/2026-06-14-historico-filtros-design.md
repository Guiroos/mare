# Design: Página /historico + Filtros no Dashboard

**Data:** 2026-06-14
**Escopo:** Nova página `/historico` com feed unificado e filtros; adição de filtros client-side na `TransactionList` do dashboard.

---

## Contexto

A `TransactionList` atual vive apenas no dashboard e exibe somente transações avulsas/parceladas do mês corrente, com chips de agrupamento (por data / por conta / por tipo). Não há como buscar, filtrar por tipo ou ver movimentações de outros meses sem trocar o mês no dashboard.

Concorrentes (Mobills, Organizze, YNAB) oferecem histórico completo com busca e filtros. Este design cobre duas entregas complementares:

1. **`/historico`** — página dedicada com feed unificado de todos os tipos de movimentação, filtros avançados e sem limitação de mês.
2. **Dashboard `TransactionList`** — filtros client-side adicionais sobre os dados já carregados do mês.

---

## 1. Página /historico

### 1.1 Rota e navegação

- Rota: `app/(app)/historico/page.tsx` (Server Component)
- Adicionada ao `Sidebar` e ao `BottomNav` com ícone `History` (lucide-react)
- Entrypoint adicional: link "Ver histórico completo →" no header da seção de transações do dashboard, passando `?de=YYYY-MM-DD&ate=YYYY-MM-DD` do mês atual

### 1.2 URL params (filtros via searchParams)

```
/historico?de=2025-01-15&ate=2025-06-14&tipos=saida_avulsa,saida_fixa,saida_parcelada,entrada,investimento,resgate&categorias=uuid1,uuid2&contas=uuid1&q=texto&cursor=2025-03-10_uuid
```

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `de` | `YYYY-MM-DD` | hoje − 90 dias | Data inicial (inclusive) |
| `ate` | `YYYY-MM-DD` | hoje | Data final (inclusive) |
| `tipos` | lista separada por vírgula | todos | `saida_avulsa`, `saida_fixa`, `saida_parcelada`, `entrada`, `investimento`, `resgate` |
| `categorias` | lista de UUIDs | — | Filtra por categoryId (saídas e fixos) |
| `contas` | lista de UUIDs | — | Filtra por accountId |
| `q` | string | — | Busca ILIKE em `name`/`description` |
| `cursor` | `YYYY-MM-DD_uuid` | — | Cursor de paginação (last date + id do último item carregado) |

### 1.3 UI — Filtros

**Linha 1:** inputs `De` / `Até` (formato dd/MM/yyyy, abrem date picker nativo) + campo de busca por texto (ILIKE).

**Linha 2:** dropdowns multi-select flutuantes (Radix Popover + checkboxes) para:
- **Tipo** — estrutura do dropdown:
  - `Entrada`
  - Seção "SAÍDAS": `Avulsa` · `Fixa` · `Parcelada`
  - `Investimento`
  - `Resgate`
- **Categoria** — lista flat das categorias do usuário (relevante para saídas e fixos)
- **Conta** — lista das contas do usuário

Quando um dropdown tem itens selecionados abaixo do total: chip fica com borda colorida + badge com a contagem. "Limpar filtros" aparece à direita quando qualquer filtro está ativo.

### 1.4 UI — Resumo acima da lista

4 mini-cards atualizados conforme os filtros ativos (calculados dos dados retornados pela query):

- Entradas (verde)
- Saídas (vermelho) — soma de avulsas + fixas + parceladas
- Investido (roxo)
- Total de itens (neutro)

### 1.5 UI — Feed

- Itens agrupados por data (mesmo padrão do `TxGroupHeader` existente)
- Cada linha exibe: avatar com inicial, nome, meta (categoria · conta), **badge de subtipo colorido** (Avulsa / Fixa / Parcelada / Entrada / Investimento / Resgate), valor
- Ações de editar/deletar mantidas onde já existem (transações avulsas, entradas)
- **Paginação:** botão "Carregar mais N itens" ao final — cursor-based, append ao estado existente sem reload da página

### 1.6 Data layer — `lib/queries/historico.ts`

Nova função `getHistoricoFeed(userId, params)`. Executa 4 queries em paralelo e merge + sort em JS:

| Fonte | `kind` | Filtro de data | Obs. |
|---|---|---|---|
| `transactions` (sem installmentGroup) | `saida_avulsa` | `date BETWEEN $de AND $ate` | |
| `transactions` (com installmentGroup) | `saida_parcelada` | `date BETWEEN $de AND $ate` | |
| `fixedExpenses` | `saida_fixa` | `referenceMonth` cobre o intervalo* | sem coluna `date` exata — data de exibição = `referenceMonth + (dueDay - 1) days`; cursor usa essa data computada |
| `incomes` | `entrada` | `referenceMonth` cobre o intervalo | confirmar coluna de data exata na implementação |
| `investments` | `investimento` | `referenceMonth` cobre o intervalo | confirmar coluna de data exata na implementação |
| `investmentWithdrawals` | `resgate` | `referenceMonth` cobre o intervalo | tabela separada de `investments` — não confundir |

*Para `fixedExpenses`, `incomes` e `investments`: filtrar pelos `referenceMonth` cujo primeiro dia ≥ `de` e último dia ≤ `ate`. Refinamento por dia exato feito em JS após o fetch.

Filtros condicionais com `and()` do Drizzle — omitidos quando o param não está presente.

Paginação: 50 itens por página. Cursor = `{ date, id }` do último item retornado.

---

## 2. Filtros no Dashboard — TransactionList

### 2.1 O que muda

Dois novos controles client-side adicionados **acima** dos chips de agrupamento existentes, sem nenhum fetch extra (dados do mês já estão carregados):

**Linha nova (acima dos chips existentes):**
- Input de busca por texto — filtra `t.name` case-insensitive
- Dropdown multi-select de **Conta** (mesmo padrão flutuante do `/historico`)

**Linha existente (chips de agrupamento):**
- Mantida como está
- Adicionados chips de subtipo antes do divisor: **Avulsas** / **Parceladas** (toggle, ambos ativos por default)

O agrupamento e o filtro são aplicados em sequência: filtra primeiro, depois agrupa.

### 2.2 Entrypoint para /historico

Header da seção de transações no dashboard ganha link "Ver histórico completo →" (à direita, estilo `text-accent`). Ao clicar, navega para `/historico?de=YYYY-MM-01&ate=YYYY-MM-31` do mês corrente.

### 2.3 Badge de subtipo nas linhas

Cada `TransactionRow` ganha badge colorido de subtipo (Avulsa / Parcelada) — consistência visual com o `/historico`. Já existe lógica para detectar se tem `installmentGroup`.

---

## 3. Fora do escopo (MVP)

- Filtro por valor (maior/menor que)
- Busca full-text com ranking
- Filtros salvos / favoritos
- Exportar CSV
- Filtro por intervalo customizado de horas

---

## 4. Arquivos a criar/modificar (estimativa)

| Arquivo | Ação |
|---|---|
| `app/(app)/historico/page.tsx` | Criar — Server Component, lê searchParams, chama query |
| `app/(app)/historico/HistoricoClient.tsx` | Criar — filtros, feed, paginação |
| `app/(app)/historico/HistoricoFilters.tsx` | Criar — barra de filtros com dropdowns flutuantes |
| `lib/queries/historico.ts` | Criar — `getHistoricoFeed` com 5 queries paralelas (transactions, fixedExpenses, incomes, investments, investmentWithdrawals) + merge + sort |
| `components/dashboard/TransactionList.tsx` | Modificar — linha de busca+conta + chips de subtipo + link "Ver histórico →" |
| `components/ui/multiselect-dropdown.tsx` | Criar — componente reutilizável (Radix Popover + checkboxes), usado em /historico e dashboard |
| `components/app/Sidebar.tsx` | Modificar — adicionar item /historico com ícone History |
| `components/app/BottomNav.tsx` | Modificar — adicionar item /historico com ícone History |
