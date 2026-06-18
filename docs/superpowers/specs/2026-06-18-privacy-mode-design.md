# Privacy Mode — Design Spec

**Data:** 2026-06-18  
**Status:** Aprovado pelo usuário

---

## Contexto

Usuário quer ocultar valores monetários sensíveis (entradas, saldo, investimentos) ao acessar o app em ambientes públicos (ex: trabalho), sem sair da conta. O modo privado substitui valores por `R$ ••••` e persiste via `localStorage`.

---

## Escopo de páginas

- `/dashboard`
- `/historico`
- `/investimentos`
- `/metas`
- `/panorama`

Páginas fora do escopo (categorias, contas, devedores, parcelas, configuração-mês, registro) não são afetadas.

---

## Arquitetura

### 1. Provider — `components/providers/PrivacyMode.tsx`

Novo arquivo, mesmo padrão do `RegistrationDialogProvider` existente.

```ts
// Contexto expõe:
{
  isPrivate: boolean
  toggle: () => void
}
```

- Lê `localStorage.getItem('mare:privacy-mode')` no `useEffect` inicial (evita hydration mismatch — inicia como `false` no servidor, sincroniza no cliente)
- Persiste via `localStorage.setItem('mare:privacy-mode', String(next))`
- Entra em `app/(app)/layout.tsx` envolvendo `<RegistrationDialogProvider>`

### 2. Componente `<SensitiveAmount>`

Client component em `components/providers/PrivacyMode.tsx` (co-localizado com o provider).

```tsx
<SensitiveAmount value={number} className?: string />
```

- `isPrivate = false` → renderiza `formatCurrency(value)` 
- `isPrivate = true` → renderiza `R$ ••••`
- Aceita `className` para herdar tipografia do chamador

### 3. Hook `usePrivacyMode()`

Exportado do mesmo arquivo. Retorna `{ isPrivate, toggle, mask }` onde:

```ts
mask: (value: number) => string
// retorna formatCurrency(value) ou 'R$ ••••'
```

Usado quando o valor está interpolado em string (ex: badge `{mask(totalIncomes)}`).

### 4. Componente `<PrivacyToggle />`

Client component em `components/providers/PrivacyMode.tsx`.

```tsx
<Button variant="ghost" size="icon" onClick={toggle} aria-label={isPrivate ? 'Mostrar valores' : 'Ocultar valores'}>
  {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</Button>
```

---

## O que fica oculto

### Dashboard (`/dashboard`)
- `SummaryCards` — saldo hero, entradas, gastos, investido, valores absolutos do orçamento (percentual permanece visível)
- Badges nos headers das Sections "Entradas" e "Investimentos"
- `IncomeList` — valor de cada entrada
- `InvestmentList` — valor de cada investimento e rendimento
- `TransactionList` — valor de cada transação
- `FixedExpenseList` — valor de cada gasto fixo

### Histórico (`/historico`)
- `HistoricoClient` — valor de cada item do feed

### Investimentos (`/investimentos`)
- `PatrimonyHero` — patrimônio total, aporte total, rendimento total
- `InvestmentTypeCard` — saldo por tipo, aporte, rendimento
- Lista de resgates — valores

### Metas (`/metas`)
- Valor atual acumulado e valor alvo de cada meta
- Contribuições individuais

### Panorama (`/panorama`)
- `AnnualSummaryCards` — totais anuais
- Tabela mensal — colunas entradas, despesas, investido, saldo
- Rodapé da tabela — totais YTD

### O que NÃO fica oculto (intencional)
- Nomes de categorias, fontes de renda, contas
- Percentuais de orçamento (ex: "72%")
- Datas, descrições, tags
- Contadores (ex: "3 transações este mês")

---

## Toggle — onde aparece

### SettingsDialog
Nova seção "Privacidade" entre "Aparência" e "Zona de perigo":

```
Privacidade
Oculta valores monetários nas páginas financeiras.
[Switch] Modo privado
```

Usa o componente `Switch` do DS. Lê/escreve via `usePrivacyMode()`.

### Headers das páginas (ícone Eye/EyeOff)
`<PrivacyToggle />` inserido como client island nas 5 páginas:

| Página | Posição |
|--------|---------|
| Dashboard | Ao lado do `DashboardFAB` no `MonthSelector` (prop `action`) |
| Histórico | `PageHeader` — lado direito via `flex items-start justify-between` |
| Investimentos | `PageHeader` — lado direito |
| Metas | `PageHeader` — lado direito |
| Panorama | Ao lado do botão de download existente |

---

## Considerações de implementação

### Hydration
O provider inicia com `isPrivate = false` (SSR) e sincroniza o `localStorage` no `useEffect`. Isso garante que não há mismatch entre server e client render. Valor mascarado nunca aparece no HTML inicial.

### Páginas com `formatCurrency` inline em Server Components
Panorama e Metas têm chamadas `formatCurrency(...)` diretamente no JSX do Server Component. A estratégia é extrair as partes sensíveis para client components que recebem os dados como props:

- **Panorama** — extrair `<PanoramaTable data={overview} />` como client component; converter `AnnualSummaryCards` para `'use client'` (é folha)
- **Metas** — extrair `<MetasList goals={goalsData} />` como client component

Isso evita converter páginas inteiras para `'use client'` e mantém o data fetching no servidor.

### SummaryCards, AnnualSummaryCards, PatrimonyHero
Todos são Server Components folha (sem filhos server abaixo). Converter cada um para `'use client'` e usar `usePrivacyMode()` internamente.

---

## Persistência

- Chave: `'mare:privacy-mode'`
- Valor: `'true'` | `'false'`
- Escopo: `localStorage` do browser (por device, não sincroniza entre dispositivos)
- Sem expiração — persiste até o usuário desativar manualmente

---

## Fora do escopo desta feature

- Mascaramento de gráficos (Recharts) — valores nos tooltips e eixos permanecem visíveis; fase futura
- Sincronização entre dispositivos
- Senha/PIN para desativar o modo privado
