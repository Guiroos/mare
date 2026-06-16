# Alertas de Orçamento

## Problema / Contexto

O Maré tem orçamento por categoria mas não avisa quando o usuário está próximo ou além do limite. O usuário precisa entrar no dashboard ativamente para perceber. Mobills envia alertas por email; YNAB exibe visualmente no app. A consequência é que o orçamento vira decoração em vez de ferramenta real.

## O que já temos

- Budget por categoria já calculado no dashboard (`BudgetBar` com tone `ok`/`warn`/`over`)
- `getAnnualOverview` e `getDashboardData` já retornam `budget` e `spent` por categoria
- Vercel Cron já configurado no projeto (usado para rollover de gastos fixos)
- Lógica de `tone` já existe em `BudgetBar` — sabemos quando uma categoria ultrapassa 80% e 100%

## MVP — como fazer

**Fase 1 — In-app (sem email):**

Banner ou seção no dashboard listando categorias em estado `warn` (>80%) ou `over` (>100%) no mês atual. Aparece só quando há pelo menos uma categoria nesse estado.

Implementação: derivar do array de categorias já buscado em `getDashboardData`. Zero queries extras. Componente `BudgetAlertBanner` no topo do dashboard.

**Fase 2 — Email semanal (opt-in):**

Cron toda segunda-feira: para cada usuário com categorias `over`, envia email com lista de categorias estouradas e percentual.

Stack: Resend (gratuito até 3k emails/mês) + template HTML simples. Campo `alertsEnabled` em `userSettings` para opt-in.

## Fora do MVP

- Alertas por push notification (PWA)
- Alerta instantâneo ao lançar uma transação que estoura o budget
- Configuração de threshold por categoria (ex: alertar em 70% para uma, 90% para outra)
- Integração com WhatsApp
