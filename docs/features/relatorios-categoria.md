# Relatórios Visuais por Categoria

## Problema / Contexto

O Panorama mostra evolução mensal agregada (income vs expense), mas não responde perguntas como "quanto gastei em alimentação nos últimos 6 meses?" ou "qual categoria consome mais do meu orçamento?". Mobills e Organizze têm gráficos de pizza por categoria. YNAB tem relatório de gastos por categoria com drill-down.

## O que já temos

- `getAnnualOverview` retorna despesas mensais, mas sem breakdown por categoria
- `getAnnualExpensesByGroup` existe em `lib/queries/panorama.ts` — já agrega por grupo
- Recharts já instalado e usado em múltiplos charts no projeto
- Estrutura de categorias e grupos já completa

## MVP — como fazer

**Nova seção no Panorama** (ou página `/relatorios` separada):

**1. Pizza de despesas do mês:** top categorias do mês selecionado. Query nova que agrupa `transactions + fixedExpenses` por `categoryId` para o mês. Recharts `PieChart` com `Cell` por categoria.

**2. Barras empilhadas por grupo ao longo do ano:** evolução mensal mas com cada barra segmentada por grupo de categoria. Reutiliza `getAnnualExpensesByGroup` que já existe.

**3. Tabela de top 10 categorias do mês:** ranking com valor gasto, % do total e diferença vs mês anterior. Sem chart — só uma `<TxList>` adaptada.

**Interatividade:** clicar em uma fatia da pizza filtra a lista de transações do Registro (via URL param — reutiliza a feature de busca/filtro).

## Fora do MVP

- Drill-down de categoria → lista de transações inline
- Relatório customizável (escolher categorias, período)
- Comparativo vs mesmo período do ano anterior
- Exportação do relatório como PDF
