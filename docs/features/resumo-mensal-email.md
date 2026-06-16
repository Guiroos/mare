# Resumo Mensal por Email

## Problema / Contexto

O usuário que não entra no app todo dia perde o contexto do mês. Um email de fechamento no dia 1 do mês seguinte — "você gastou X, economizou Y, sua maior categoria foi Z" — mantém o engajamento e a consciência financeira sem exigir que o usuário abra o app. Mobills faz isso; é um diferencial de retenção.

## O que já temos

- Vercel Cron configurado e funcionando (cron de rollover de gastos fixos)
- `getDashboardData` e `getAnnualOverview` já calculam todos os totais necessários
- `userSettings` pode receber campo de preferência de email
- `userId` → `email` via tabela `users` do NextAuth adapter

## MVP — como fazer

**Cron:** dia 1 de cada mês, processa o mês anterior para todos os usuários.

**Conteúdo do email:**
- Total de receitas vs despesas vs investimentos
- Saldo do mês (positivo/negativo)
- Top 3 categorias de despesa
- Comparação com o mês anterior (melhorou/piorou)
- Link direto para o Panorama

**Stack:** Resend (free tier: 3.000 emails/mês, sem cartão de crédito). Template HTML simples — sem biblioteca de email complexa.

**Opt-in:** campo `monthlyEmailEnabled boolean default true` em `userSettings`. Configuração em `/configuracao-mes` ou em `/admin` próprio do usuário.

**Rota:** `/api/cron/monthly-summary` — mesmo padrão da rota existente de rollover.

## Fora do MVP

- Template de email com design elaborado (MJML, React Email)
- Resumo semanal (além do mensal)
- Email de alerta quando budget é estourado (integra com feature de alertas)
- Personalização do conteúdo do email
- Unsubscribe com link tokenizado
