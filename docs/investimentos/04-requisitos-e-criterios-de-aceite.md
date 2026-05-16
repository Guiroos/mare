# Investimentos - requisitos e criterios de aceite

## 0. Status de implementacao em 12/05/2026

1. `RF-01` concluido.
2. `RF-02` concluido.
3. `RF-03` concluido.
4. `RF-04` concluido.
5. `RF-05` concluido.
6. `RF-06` concluido.
7. `RF-07` concluido.
8. `RF-08` concluido.
9. `RF-09` concluido.

## 1. Requisitos funcionais

### RF-01 - Resgates limitados aos ultimos 6 meses

1. A query de resgates deve retornar apenas registros dentro da janela de 6 meses comunicada pela tela.
2. A ordenacao deve continuar do mais recente para o mais antigo.
3. O empty state deve refletir exatamente esse recorte.

### RF-02 - Pendencia restrita ao mes corrente

1. Um tipo so deve ser considerado `pendingYield` quando:
   1. existir aporte no mes corrente;
   2. o rendimento desse mesmo mes estiver ausente.
2. Linhas antigas sem rendimento nao devem acionar o badge global do tipo.
3. O mes destacado no badge deve sempre corresponder ao mes corrente elegivel.

### RF-03 - Hero comparando contra o ultimo mes fechado

1. O delta monetario do hero deve usar:
   1. patrimonio do ultimo periodo elegivel;
   2. patrimonio do ultimo mes fechado anterior.
2. Mes corrente com pendencia nao deve ser usado como base consolidada para a comparacao.
3. O label do mes anterior deve refletir o periodo efetivamente comparado.

### RF-04 - Cor persistida por tipo de investimento

1. `investment_types` deve persistir cor principal e fundo sutil, ou uma estrategia equivalente ja compativel com o restante do produto.
2. Create e edit de tipo devem suportar a configuracao dessa cor.
3. A tela deve usar a cor persistida em:
   1. avatar;
   2. barra de share mobile;
   3. demais pontos equivalentes definidos pelo design system.
4. Deve existir fallback previsivel para tipos sem cor cadastrada.
5. Quando o usuario mantiver `Cor automatica`, o tipo deve usar e persistir a cor default oficial do produto.
6. A dialog deve reabrir com `Cor automatica` ativa quando a cor salva for igual ao default oficial.

### RF-05 - Header mobile aderente ao handoff

1. A barra de share deve permanecer visivel mesmo quando o tipo estiver pendente.
2. O status pendente deve aparecer no bloco de valor, com indicacao do mes quando disponivel.
3. O acordeao deve continuar permitindo multiplos itens abertos simultaneamente.

### RF-06 - Grafico de evolucao simplificado

1. Deve existir apenas uma fonte de legenda visivel por secao.
2. O grafico deve priorizar:
   1. linha principal do patrimonio;
   2. area de apoio sob a linha principal;
   3. linha tracejada do aporte acumulado.
3. Tooltip mensal deve permanecer disponivel.

### RF-07 - Empty state padronizado para resgates

1. O estado vazio da secao de resgates deve reutilizar o padrao de `EmptyState` ou uma composicao derivada formal do mesmo componente.
2. O texto deve seguir a mensagem definida pelo handoff:
   1. `Sem resgates nos ultimos 6 meses.`
3. A acao de registrar resgate deve continuar disponivel na secao.

### RF-08 - Historico mensal compacto por tipo

1. Desktop e mobile devem exibir inicialmente apenas os 3 meses mais recentes de cada tipo.
2. O historico restante deve continuar acessivel por acao `Ver mais`.
3. A expansao deve ocorrer por tipo, sem alterar consultas ou calculos do dominio.

### RF-09 - Tabela desktop com colunas financeiras estaveis

1. No desktop, `Mes`, `Aporte`, `Rendimento` e a coluna de acoes devem ter larguras previsiveis.
2. `Nota` deve ocupar o espaco restante da tabela.
3. Valores monetarios nao devem quebrar linha de forma incoerente.

## 2. Requisitos de experiencia e design system

### UX-01 - Consistencia de semantica visual

1. `warning` deve significar apenas pendencia real e atual.
2. `positive` deve seguir reservado para rendimento confirmado.
3. `accent` deve permanecer voltado a grafico, chamadas primarias e informacoes de destaque previstas no handoff.

### UX-02 - Estabilidade de reconhecimento

1. O mesmo tipo de investimento deve manter a mesma identidade cromatica independentemente de ordenacao.
2. A tela nao deve mudar cor por variacao de saldo.

### UX-03 - Fidelidade responsiva

1. Desktop e mobile devem preservar a hierarquia do handoff, ainda que com adaptacoes legitimas ao codebase atual.
2. Informacoes de saldo, share e status nao devem competir entre si nos cards mobile.

### UX-04 - Vocabulario financeiro consistente em pt-BR

1. A UI deve usar `Rendimento` para valores monetarios.
2. A UI deve usar `Rentabilidade` para percentuais compactos ou descritivos equivalentes.
3. Rotulos nao devem sugerir periodicidade diferente da metrica realmente calculada.

## 3. Criterios de aceite

1. `[ok]` Um resgate com data anterior a 6 meses nao aparece na tela.
2. `[ok]` O empty state de resgates aparece quando nao houver itens dentro da janela de 6 meses, mesmo que existam registros mais antigos.
3. `[ok]` Um investimento antigo com rendimento ausente nao ativa badge de pendencia no tipo.
4. `[ok]` Um aporte do mes corrente sem rendimento:
   1. ativa badge de pendencia;
   2. destaca a linha do mes;
   3. exibe `pendente` no campo de rendimento.
5. `[ok]` O delta do hero ignora mes corrente pendente como periodo consolidado.
6. `[ok]` A cor de um tipo permanece a mesma apos a reordenacao por saldo.
7. `[ok]` Tipos com `Cor automatica` persistem o default oficial da Mare.
8. `[ok]` A dialog reabre com `Cor automatica` ativa quando a cor salva for o default oficial.
9. `[ok]` No mobile, a barra de share continua visivel em tipos pendentes.
10. `[ok]` No mobile, o status pendente aparece no bloco de total com referencia mensal coerente.
11. `[ok]` O grafico nao mostra legenda duplicada.
12. `[ok]` O grafico preserva tooltip e melhora aderencia a area/linha previstas no handoff.
13. `[ok]` O empty state de resgates usa o padrao de componente adotado pelo produto.
14. `[ok]` Desktop e mobile mostram inicialmente apenas os 3 meses mais recentes por tipo.
15. `[ok]` O botao `Ver mais` expande o restante do historico apenas do tipo acionado.
16. `[ok]` A tabela desktop preserva larguras estaveis para `Mes`, `Aporte`, `Rendimento` e acoes, deixando `Nota` flexivel.
17. `[ok]` A UI evita `Yield` nos textos visiveis e usa `Rentab.` / `Rentab. acum.` onde o espaco e compacto.
18. `[ok]` A taxa exibida no rodape nao e mais apresentada como mensal quando representa uma leitura acumulada.
