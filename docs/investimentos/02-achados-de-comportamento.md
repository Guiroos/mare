# Investimentos - achados de comportamento

## 1. Resgates exibidos fora do recorte de 6 meses

**Status:** resolvido em 12/05/2026.

A analise original identificou que a UI comunicava `ultimos 6 meses`, mas a query retornava todo o historico de resgates do usuario.

### Impacto

1. Texto da interface e dados exibidos ficam inconsistentes.
2. A lista pode crescer indefinidamente.
3. O estado vazio deixa de significar exatamente o que a tela comunica.

### Direcao recomendada

1. Filtrar a consulta de resgates pela janela de 6 meses usada pela tela.
2. Manter ordenacao do mais recente para o mais antigo.
3. Tratar o empty state a partir desse mesmo recorte.

### Solucao aplicada

1. `getInvestmentWithdrawals` passou a filtrar pela janela de 6 meses baseada no inicio do mes.
2. A ordenacao descendente por data foi preservada.
3. O empty state passou a representar exatamente esse recorte.

## 2. Estado de rendimento pendente calculado para qualquer mes

**Status:** resolvido em 12/05/2026.

O handoff define pendencia apenas quando existe aporte no mes corrente sem rendimento lancado. Antes da correcao, a implementacao considerava qualquer mes incompleto como pendente.

### Impacto

1. Tipos antigos podem permanecer marcados como pendentes indefinidamente.
2. O badge de status pode apontar para um mes que nao deveria ser destacado.
3. A hierarquia visual passa a enfatizar um alerta fora da regra de negocio.

### Direcao recomendada

1. Restringir `pendingYield` ao mes corrente.
2. Separar claramente:
   1. linha historica incompleta;
   2. pendencia atual que merece destaque global.
3. Derivar o label de mes apenas a partir da pendencia elegivel.

### Solucao aplicada

1. `pendingYield` agora nasce apenas quando o `referenceMonth` do investimento e o mes corrente e ha aporte sem rendimento.
2. A UI recebe `pendingReferenceMonth` e usa esse campo para badge, destaque e microcopy.
3. Meses antigos sem rendimento deixaram de ser tratados como alerta atual.

## 3. Variacao do hero comparada contra mes ainda aberto

**Status:** resolvido em 12/05/2026.

Antes da correcao, o hero comparava os dois ultimos pontos da timeline, mesmo quando o mes mais recente ainda possuia rendimento pendente. O handoff determina comparacao contra o ultimo mes fechado.

### Impacto

1. A variacao mensal pode ser exibida de forma parcial.
2. O percentual de crescimento pode parecer pior ou melhor do que de fato esta consolidado.
3. O card principal perde confiabilidade como leitura executiva.

### Direcao recomendada

1. Formalizar qual e o ultimo periodo consolidado.
2. Calcular delta e label do hero com base nesse periodo.
3. Evitar que mes corrente pendente seja tratado como comparavel fechado.

### Solucao aplicada

1. A pagina identifica quando existe pendencia elegivel no mes corrente.
2. Nessa situacao, o hero remove o ponto corrente da comparacao e usa apenas a timeline consolidada.
3. O delta e o label mensal passam a refletir o periodo efetivamente comparado.

## 4. Dependencias de regra de negocio

As tres correcoes acima precisam concordar sobre:

1. O que e `mes corrente`.
2. O que e `mes fechado`.
3. Como o periodo de 6 meses e definido para leituras historicas.

Essas convencoes foram aplicadas na implementacao atual. Caso a janela de 6 meses ou a nocao de periodo consolidado passem a ser reutilizadas em outras telas, vale extrair helpers dedicados para evitar divergencia futura.
