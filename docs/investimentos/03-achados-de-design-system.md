# Investimentos - achados de design system

## 1. Cores por tipo de investimento nao persistidas

**Status:** resolvido em 12/05/2026.

O handoff define que cada tipo deve ter cor propria vinda do banco. Antes da correcao, a UI usava uma paleta por indice de ordenacao.

### Impacto

1. A cor de um tipo pode mudar quando a ordenacao por saldo muda.
2. O reconhecimento visual fica instavel.
3. A implementacao diverge de uma convencao explicita do handoff.

### Direcao recomendada

1. Persistir identidade cromatica por tipo.
2. Consumir essa identidade em avatar, barra de share e superficies equivalentes.
3. Reaproveitar o padrao ja existente em categorias sempre que fizer sentido.

### Solucao aplicada

1. `investment_types` passou a persistir `color` e `bgColor`.
2. Create e edit de tipo agora suportam configuracao cromatica.
3. O modo `Cor automatica` usa o azul principal da Mare como default persistido.
4. Se a cor salva for o default oficial, a dialog reabre interpretando o tipo como automatico.
5. Cards desktop e mobile passaram a consumir a cor persistida em vez de depender da ordenacao por saldo.

## 2. Header mobile perde informacao quando ha pendencia

**Status:** resolvido em 12/05/2026.

No handoff mobile, a barra de participacao continua visivel e o estado pendente aparece no bloco de total do tipo. Antes da correcao, a barra sumia e entrava um badge generico.

### Impacto

1. O usuario perde a leitura de share do patrimonio exatamente nos itens com maior necessidade de contexto.
2. O status fica menos especifico do que o desenho de referencia.
3. A hierarquia do card mobile diverge do handoff.

### Direcao recomendada

1. Manter a barra de share mesmo com pendencia.
2. Exibir o estado pendente junto ao bloco de total.
3. Mostrar referencia mensal quando houver dados suficientes.

### Solucao aplicada

1. A barra de share continua visivel para tipos pendentes.
2. O status passou para o bloco de valor do card.
3. Quando houver mes elegivel, a referencia abreviada aparece junto ao status.

## 3. Grafico de evolucao com redundancia e menor fidelidade visual

**Status:** resolvido em 12/05/2026.

A pagina renderiza legenda no cabecalho e o grafico renderiza outra legenda. Alem disso, o handoff trabalha com area preenchida para o patrimonio total e linha tracejada para aporte acumulado.

### Impacto

1. A area do grafico fica mais ruidosa.
2. A secao perde fidelidade em relacao a referencia visual.
3. A leitura comparativa fica menos alinhada ao sistema visual proposto.

### Direcao recomendada

1. Usar apenas uma fonte de legenda visivel.
2. Aproximar o grafico da linguagem do handoff:
   1. linha principal do patrimonio;
   2. area de apoio sob a linha;
   3. linha tracejada de aporte acumulado.
3. Preservar tooltip mensal.

### Solucao aplicada

1. A legenda interna do grafico foi removida, mantendo apenas a legenda da secao.
2. O patrimonio total passou a usar linha principal com area de apoio preenchida.
3. O aporte acumulado continua em linha tracejada.
4. O tooltip mensal foi preservado.

## 4. Empty state de resgates nao reutiliza o padrao comum

**Status:** resolvido em 12/05/2026.

A tela ja utilizava o componente global de `EmptyState`, mas a area de resgates recriava manualmente outra composicao.

### Impacto

1. A tela passa a manter dois padroes distintos de vazio.
2. Futuros ajustes no componente-base nao chegam a esta area.
3. A consistencia do design system se perde em um estado recorrente.

### Direcao recomendada

1. Reusar `EmptyState` ou uma variante formal do padrao.
2. Preservar a acao de registrar resgate.
3. Alinhar microcopy ao handoff.

### Solucao aplicada

1. A secao de resgates passou a reutilizar `EmptyState`.
2. A acao de registrar resgate continua disponivel no cabecalho da secao.
3. A microcopy foi alinhada para `Sem resgates nos ultimos 6 meses.`.

## 5. Historico mensal denso demais para leitura inicial

**Status:** resolvido em 12/05/2026.

O handoff previa uma leitura inicial mais curta do historico mensal, com apenas os meses mais recentes visiveis e uma acao de expansao. Antes do ajuste, desktop e mobile exibiam todos os meses de uma vez.

### Impacto

1. Cards com muitos registros crescem demais e empurram o restante da pagina.
2. A leitura de comparacao entre tipos fica menos escaneavel.
3. A implementacao perde aderencia ao comportamento proposto no handoff.

### Direcao recomendada

1. Mostrar inicialmente apenas os 3 meses mais recentes por tipo.
2. Preservar todo o historico ja carregado, sem alterar query ou regra de negocio.
3. Liberar o restante sob demanda com `Ver mais`.

### Solucao aplicada

1. Cards desktop e accordion mobile exibem primeiro os 3 meses mais recentes.
2. O restante do historico abre por tipo via botao `Ver mais`.
3. A ordem inicial foi ajustada para privilegiar os meses mais recentes.

## 6. Tabela desktop com largura instavel nas colunas financeiras

**Status:** resolvido em 12/05/2026.

No desktop, mes, aporte e rendimento dividiam espaco de forma menos previsivel com a coluna de nota. Isso dificultava a leitura comparativa dos valores quando havia textos longos.

### Impacto

1. Valores monetarios ficam visualmente menos alinhados entre linhas e cards.
2. A largura util das colunas varia mais do que o necessario.
3. A nota disputa espaco com dados de maior prioridade de leitura.

### Direcao recomendada

1. Fixar larguras para `Mes`, `Aporte`, `Rendimento` e a coluna de acoes.
2. Deixar `Nota` ocupar o espaco restante.
3. Evitar quebra visual dos valores em reais.

### Solucao aplicada

1. A tabela desktop passou a usar `table-fixed` com `colgroup`.
2. `Mes`, `Aporte`, `Rendimento` e acoes usam larguras estaveis.
3. `Nota` permanece flexivel e os campos monetarios usam `whitespace-nowrap`.

## 7. Microcopy financeira mistura portugues com `yield`

**Status:** resolvido em 12/05/2026.

A tela ja utilizava `Rendimento` na maior parte da experiencia, mas ainda mostrava `Yield` em pontos de percentual. Em uma interface pt-BR, isso cria uma terminologia quebrada.

### Impacto

1. A nomenclatura da tela fica inconsistente.
2. O mesmo conceito parece ganhar nomes diferentes sem necessidade.
3. Um percentual acumulado podia ser lido como uma metrica distinta apenas por causa do rotulo.

### Direcao recomendada

1. Reservar `Rendimento` para valor monetario.
2. Usar `Rentabilidade` para percentuais.
3. Evitar chamar de mensal uma metrica que hoje e acumulada.

### Solucao aplicada

1. A UI passou a usar `Rentab.` e `Rentab. acum.` nos pontos compactos.
2. O rodape deixou de mostrar `Yield mensal` para uma taxa acumulada.
3. A semantica visual da tela ficou alinhada ao restante da microcopy em portugues.
