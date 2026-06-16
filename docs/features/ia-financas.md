# IA para Finanças Pessoais

## Problema / Contexto

Em 2026, apps como Financinha e ZapGastos já oferecem registro por WhatsApp com IA e categorização automática. A IA pode reduzir fricção de entrada de dados, gerar insights que o usuário não perceberia sozinho, e diferenciar o Maré num mercado que ainda está aprendendo a usar esses recursos bem.

> Esta feature é exploratória — não há timeline. O objetivo deste documento é mapear os casos de uso antes de decidir o que vale implementar.

## Casos de uso mapeados

### 1. Categorização automática na importação
**Problema:** ao importar extrato, o usuário precisa categorizar cada transação manualmente.  
**Com IA:** enviar a descrição da transação para o modelo e obter categoria sugerida com confiança. Casos de baixa confiança ficam para revisão manual.  
**Viabilidade:** alta. Uma chamada de API por transação (barata). Pode usar Claude Haiku para custo mínimo.

### 2. Insights mensais em linguagem natural
**Problema:** os dados existem mas o usuário precisa interpretá-los.  
**Com IA:** ao fechar o mês, gerar 3-5 observações em português: "Você gastou 40% mais em delivery do que no mês passado", "Sua taxa de poupança foi de 18% — acima da sua média de 12%".  
**Viabilidade:** média. Requer montar contexto financeiro e enviar para o modelo. Custo por usuário por mês.

### 3. Entrada por linguagem natural
**Problema:** abrir o app, navegar até Registro, preencher formulário.  
**Com IA:** campo de texto livre "O que você gastou?" → "Gastei R$45 no almoço no restaurante X hoje" → cria transação com data, valor, categoria e descrição sugeridos.  
**Viabilidade:** média. Requer parsing estruturado (function calling / JSON mode). Útil especialmente em mobile.

### 4. Assistente de orçamento
**Problema:** o usuário não sabe se o orçamento que definiu é realista.  
**Com IA:** baseado no histórico dos últimos 3 meses, sugerir orçamentos por categoria: "Você gasta em média R$320 em alimentação — seu orçamento atual de R$200 foi estourado nos 3 últimos meses".  
**Viabilidade:** alta. Os dados já existem — é só formatar o contexto e pedir sugestão ao modelo.

## O que seria necessário

- Chave de API da Anthropic (Claude) ou OpenAI
- Campo de configuração para habilitar IA (opt-in por privacidade)
- Cuidado com dados financeiros pessoais sendo enviados para APIs externas — anonimizar ou agregar antes de enviar

## Próximo passo sugerido

Quando quiser avançar: começar pelo **caso 1 (categorização na importação)** — menor risco, impacto imediato e encadeia com a feature de importação de extrato.
