# Investimentos - code review pos-implementacao

## 1. Contexto

Este documento registra a revisao tecnica feita em 12/05/2026 sobre as alteracoes recentes da area de investimentos, com foco em:

1. regressao funcional;
2. aderencia ao design system descrito em `CLAUDE.md` e `.claude/`;
3. consistencia de comportamento entre os novos ajustes e o restante do produto.

A revisao considera o estado local do checkout em 12/05/2026, incluindo as alteracoes ainda nao versionadas ligadas a:

1. grafico de evolucao;
2. cores persistidas por tipo de investimento;
3. historico mensal compacto com `Ver mais`;
4. tratamento de zero explicito em inputs monetarios;
5. equalizacao dos CTAs `Novo tipo` e `Registrar aporte`.

## 2. Resumo executivo

1. Nao foi encontrada regressao evidente de seguranca nas actions alteradas de investimentos.
2. Os checks de ownership relevantes para `investmentTypeId` permanecem presentes nos fluxos de mutacao revisados.
3. Permanecem quatro pontos que valem entrar em backlog tecnico:
   1. uma regressao visual na linha pendente da tabela desktop;
   2. inconsistencia no tratamento de zero explicito fora de investimentos;
   3. novos botoes `Ver mais` fora do primitivo `Button`;
   4. larguras arbitrarias na tabela desktop em desacordo com as regras locais de design system.

## 3. Achados

### CR-01 - Hover da linha pendente apaga a semantica de alerta

**Severidade:** media.

**Evidencia:**

1. `components/investimentos/InvestmentTypeCard.tsx`
2. trecho da linha pendente:
   1. `bg-warning-subtle hover:bg-bg-subtle`

**Problema:**

Quando a linha esta marcada como pendente, o hover troca o fundo de `warning` por `bg-bg-subtle`. Isso reduz a leitura de alerta exatamente no estado que deveria permanecer mais evidente.

**Impacto:**

1. perda de consistencia visual com a regra de pendencia;
2. menor contraste entre linha pendente e linha comum durante interacao;
3. divergencia com a intencao registrada nos docs de investimentos.

**Direcao de correcao:**

1. manter o hover dentro da familia `warning`; ou
2. remover override de hover quando `isPending === true`.

## CR-02 - Zero explicito ficou inconsistente fora do fluxo de investimentos

**Severidade:** media.

**Evidencia:**

1. `components/ui/currency-input.tsx`
2. `components/configuracao-mes/BudgetOverrideDialog.tsx`
3. `components/categorias/CategoryDialog.tsx`

**Problema:**

O novo comportamento do `CurrencyInput` passou a preservar `0.00` no hidden input quando existe valor explicito, mas a exibicao visual de `R$ 0,00` depende de `preserveExplicitZero`.

Nos fluxos de investimentos essa prop foi aplicada, mas outros campos que tambem aceitam zero seguem sem ela, por exemplo:

1. override de orcamento mensal;
2. orcamento padrao de categoria.

**Impacto:**

1. o usuario pode enxergar campo vazio enquanto o formulario ainda submete `0.00`;
2. o comportamento de zero deixa de ser uniforme entre dominios;
3. futuros ajustes de validacao e microcopy ficam mais dificeis de razonar.

**Direcao de correcao:**

1. confirmar que zero deve ser visivel nesses fluxos;
2. aplicar `preserveExplicitZero` tambem aos campos equivalentes; ou
3. revisar a logica global do `CurrencyInput` para nao preservar zero invisivel.

## CR-03 - Botoes `Ver mais` nao usam o primitivo `Button`

**Severidade:** baixa/media.

**Evidencia:**

1. `components/investimentos/InvestmentTypeCard.tsx`
2. `components/investimentos/InvestmentTypeAccordion.tsx`
3. referencia local:
   1. `CLAUDE.md`
   2. `.claude/agents/ds-reviewer.md`

**Problema:**

Os botoes de expansao do historico mensal foram criados com `<button>` cru e classes manuais. As regras locais do design system orientam que componentes compostos usem os primitivos do DS quando o componente equivalente ja existe.

**Impacto:**

1. inconsistencia de foco e interacao;
2. manutencao visual duplicada fora de `Button`;
3. risco de novos desvios conforme o botao evoluir em acessibilidade ou tokens.

**Direcao de correcao:**

1. migrar os dois acionadores para `<Button>`;
2. se a aparencia full-width exigir comportamento especifico, compor via `className` mantendo o primitivo.

## CR-04 - Larguras arbitrarias na tabela desktop violam a regra local de tokens

**Severidade:** baixa.

**Evidencia:**

1. `components/investimentos/InvestmentTypeCard.tsx`
2. uso atual:
   1. `w-[180px]`
   2. `w-[160px]`
   3. `w-[170px]`
3. referencia local:
   1. `CLAUDE.md`

**Problema:**

As larguras foram endurecidas com valores arbitrarios entre colchetes, contrariando a orientacao local de evitar esse padrao quando nao ha token formalizado.

**Impacto:**

1. inconsistencia com a disciplina de tokens adotada no projeto;
2. maior chance de manutencao ad hoc em futuras tabelas;
3. dificuldade de consolidar um padrao reutilizavel para colunas financeiras.

**Direcao de correcao:**

1. revisar se larguras existentes do Tailwind bastam;
2. caso nao bastem, formalizar um padrao reutilizavel em vez de manter pixels soltos no componente.

## 4. Itens verificados e sem achado critico

### 4.1 Actions de investimentos

Foram revisados os fluxos:

1. `createInvestmentType`;
2. `updateInvestmentType`;
3. `upsertInvestment`;
4. `createWithdrawal`;
5. `updateWithdrawal`;
6. `deleteWithdrawal`.

Nao apareceu regressao evidente de ownership nos fluxos que recebem `investmentTypeId` do cliente. Os asserts relevantes permanecem aplicados antes das operacoes de mutacao.

### 4.2 Verificacoes automaticas

1. `npm run build:check` passou no estado revisado.
2. `npm run lint` passou no estado revisado.

## 5. Ordem sugerida de ataque

### Prioridade 1

1. corrigir `CR-01`;
2. decidir e padronizar `CR-02`.

### Prioridade 2

1. corrigir `CR-03`;
2. revisar `CR-04`.

## 6. Status

1. `CR-01` pendente.
2. `CR-02` pendente.
3. `CR-03` pendente.
4. `CR-04` pendente.
