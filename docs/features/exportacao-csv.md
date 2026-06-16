# Exportação de Transações (CSV)

## Problema / Contexto

Não há como extrair os dados do Maré para uso externo — declaração de IR, planilha própria, ou migração. Mobills e Organizze oferecem exportação. É uma feature de "confiança": o usuário sente que os dados são dele.

## O que já temos

- Todas as transações, gastos fixos e receitas já estão no banco com estrutura completa
- Auth via NextAuth — sabemos o `userId` para escopo correto
- Neon PostgreSQL — queries diretas sem custo adicional

## MVP — como fazer

**Rota de download:** `GET /api/export/transactions?month=YYYY-MM`

Retorna um CSV com cabeçalho:

```
data,descricao,categoria,grupo,conta,tipo,valor,parcela
2026-05-10,Supermercado,Alimentação,Mercado,Nubank,despesa,-150.00,
2026-05-01,Salário,Receita,,Conta Principal,receita,5000.00,
```

**Implementação:**
1. Action no servidor valida `month` e `userId`
2. Query busca `transactions + fixedExpenses + incomes` do mês
3. Monta string CSV com `Array.join('\n')`
4. Retorna `Response` com `Content-Type: text/csv` e `Content-Disposition: attachment`

**UI:** botão "Exportar CSV" no header do Registro, passando o mês atual como parâmetro.

## Fora do MVP

- Exportação de intervalo de datas (ex: ano inteiro)
- Formato OFX ou XLSX
- Exportação de investimentos separada
- Escolha de colunas para exportar
