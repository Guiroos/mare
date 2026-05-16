# Investimentos - roadmap e riscos

## 1. Priorizacao recomendada

### P0 - Corrigir semantica de dados - concluido em 12/05/2026

1. RF-01 - Resgates limitados aos ultimos 6 meses.
2. RF-02 - Pendencia restrita ao mes corrente.
3. RF-03 - Hero comparando contra o ultimo mes fechado.

### P1 - Consolidar aderencia ao design system - concluido em 12/05/2026

1. RF-04 - Cor persistida por tipo de investimento.
2. RF-05 - Header mobile aderente ao handoff.
3. RF-07 - Empty state padronizado para resgates.
4. RF-08 - Historico mensal compacto por tipo.
5. RF-09 - Tabela desktop com colunas financeiras estaveis.

### P2 - Refinar apresentacao - concluido em 12/05/2026

1. RF-06 - Grafico de evolucao simplificado.

## 2. Fatiamento tecnico sugerido

### Entrega 1 - Regras de negocio e consultas - concluida

1. Ajustar queries de resgates.
2. Ajustar calculo de pendencia.
3. Ajustar composicao da timeline e delta do hero.

### Entrega 2 - Identidade visual por tipo - concluida

1. Evoluir schema de `investment_types`.
2. Atualizar actions e formularios.
3. Consumir cores persistidas em cards desktop e mobile.

### Entrega 3 - Refinos de experiencia - concluida

1. `[ok]` Ajustar header mobile.
2. `[ok]` Consolidar empty state de resgates.
3. `[ok]` Compactar o historico mensal para 3 meses iniciais com expansao sob demanda.
4. `[ok]` Estabilizar a tabela desktop com colunas financeiras fixas e nota flexivel.
5. `[ok]` Ajustar a microcopy de percentual para `Rentab.` / `Rentab. acum.`.
6. `[ok]` Refinar grafico de evolucao.

## 3. Dependencias e riscos

1. `[resolvido]` Evoluir o schema de `investment_types` exigia migracao e cuidado com tipos ja existentes; a migracao `0007` cobre o novo schema e aplica default cromatico para tipos anteriores.
2. `[resolvido]` A regra de `ultimo mes fechado` foi aplicada ao hero quando o mes corrente possui pendencia elegivel.
3. `[resolvido]` A configuracao de cor seguiu a convencao ja usada em categorias, com `color`, `bgColor` derivado e seletor de cor.
4. `[resolvido]` O historico mensal dos tipos deixou de crescer integralmente por padrao e passou a abrir progressivamente por demanda.
5. `[resolvido]` A tabela desktop agora preserva melhor a comparacao dos dados financeiros ao reservar largura para as colunas criticas.
6. `[resolvido]` A UI removeu o termo `Yield` dos rotulos visiveis e evita chamar de mensal uma leitura que e acumulada.
7. `[parcial]` Caso a janela de 6 meses seja usada em mais de uma tela, ainda vale centralizar essa regra para evitar cortes inconsistentes.
8. `[resolvido]` O grafico de evolucao foi simplificado para remover redundancia de legenda e aproximar area/linha do handoff.

## 4. Resultado esperado

Ao final, `/investimentos` deve:

1. `[ok]` Comunicar somente estados financeiramente corretos nos pontos cobertos por P0.
2. `[ok]` Seguir com mais fidelidade o handoff oficial nos pontos planejados para esta rodada.
3. `[ok]` Reaproveitar melhor os componentes e convencoes do design system nos itens cobertos por P1.
4. `[ok]` Tornar o historico mensal mais escaneavel sem perder acesso ao detalhe.
5. `[ok]` Melhorar a estabilidade da leitura desktop nas colunas financeiras.
6. `[ok]` Manter a microcopy financeira coerente com uma aplicacao pt-BR.
7. `[ok]` Permanecer preparada para extensoes futuras sem acumular desvios visuais e semanticos; a centralizacao da janela de 6 meses continua opcional para evolucao posterior.
