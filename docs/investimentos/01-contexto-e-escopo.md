# Investimentos - contexto e escopo

## 1. Contexto

A tela `app/(app)/investimentos` ja cobre a estrutura principal definida no handoff:

1. Hero de patrimonio total.
2. Patrimonio por tipo.
3. Evolucao do patrimonio.
4. Resgates.

Em 12/05/2026, os principais desvios de comportamento e de design system descritos nesta pasta foram corrigidos, incluindo o refinamento do grafico de evolucao.

## 2. Objetivo da analise

Revisar a experiencia de `/investimentos` para que:

1. Os indicadores exibidos representem corretamente o estado financeiro do usuario.
2. Os estados de pendencia sigam a regra definida no handoff.
3. A identidade visual por tipo de investimento seja estavel e consistente.
4. O mobile preserve a hierarquia informacional planejada.
5. Empty states e componentes reaproveitem os padroes do produto.

## 3. Fonte de verdade

Esta analise considera como referencias principais:

1. `.ds/handoff/investimentos/README.md`
2. `.ds/handoff/investimentos/investments-desktop.html`
3. `.ds/handoff/investimentos/investments-mobile.html`
4. A implementacao atual em `app/(app)/investimentos`

## 4. Fora de escopo

1. Reestruturar toda a arquitetura de queries de investimentos.
2. Alterar o fluxo completo de lancamentos e resgates fora do necessario para esta tela.
3. Introduzir novos modos de visualizacao mobile alem do acordeao ja escolhido.
4. Redesenhar a experiencia geral de dashboard ou metas.

## 5. Leitura executiva

## 5. Leitura executiva atualizada

### Resolvido

1. O recorte de resgates agora acompanha os `ultimos 6 meses` comunicados pela UI.
2. A regra de pendencia foi restringida ao mes corrente com aporte sem rendimento.
3. O hero deixa de usar o mes corrente pendente como periodo consolidado para comparacao.
4. A cor dos tipos de investimento passou a ser persistida em `investment_types`.
5. O fluxo suporta cor automatica com default do design system e cor manual.
6. O mobile preserva a leitura de share mesmo quando ha pendencia.
7. O estado vazio de resgates reaproveita o padrao global de `EmptyState`.

### Fechado

1. O grafico de evolucao foi simplificado para manter apenas uma legenda visivel, preservar tooltip e aproximar area/linha do handoff.

Os detalhes de diagnostico, decisao e aceite estao separados nos arquivos seguintes.
