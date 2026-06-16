# Busca e Filtro no Registro

## Problema / Contexto

A página `/registro` hoje lista transações do mês sem nenhum mecanismo de busca ou filtro. Para encontrar uma transação específica o usuário precisa rolar a lista manualmente. Todos os concorrentes (Mobills, Organizze, YNAB) oferecem filtros por categoria, conta e data.

## O que já temos

- Transações agrupadas por data no `RegistroPageClient`
- Dados de `categoryId`, `accountId`, `description` já presentes em cada item
- Chips de navegação de mês já existem — padrão de UI reutilizável

## MVP — como fazer

**Filtros via URL search params** (sem state no servidor, linkável):

- `?categoria=uuid` — filtro por categoria
- `?conta=uuid` — filtro por conta  
- `?q=texto` — busca por descrição (ILIKE no banco)

**UI:** barra de filtros no topo do Registro com `<Chip>` para categorias frequentes e um `<Input>` de busca. Chips de categoria derivados das categorias do usuário.

**Query:** adicionar `where` condicional em `getTransactions` com os parâmetros recebidos. Já existe a estrutura da query — é extensão direta.

**Reset de filtros:** chip "Limpar filtros" quando algum filtro está ativo, com badge de contagem.

## Fora do MVP

- Filtro por intervalo de datas customizado (além do mês)
- Busca full-text com ranking de relevância
- Filtros salvos / favoritos
- Filtro por valor (maior/menor que)
