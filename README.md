# Maré

Aplicativo de finanças pessoais para acompanhar transações, gastos fixos, parcelamentos, investimentos e metas por mês de referência.

## Tecnologias

- [Next.js 16](https://nextjs.org/) (App Router)
- [Drizzle ORM](https://orm.drizzle.team/) + [Neon](https://neon.tech/) (PostgreSQL serverless)
- [NextAuth v4](https://next-auth.js.org/) com Google OAuth
- [Serwist](https://serwist.pages.dev/) (PWA)
- [Recharts](https://recharts.org/)
- [Tailwind CSS](https://tailwindcss.com/) + DS Maré (design system próprio)
- [Vitest](https://vitest.dev/) (testes unitários e de integração)

## Pré-requisitos

- Node.js >= 24.0.0
- Conta no [Neon](https://neon.tech/) para o banco de dados
- Credenciais OAuth do Google (via [Google Cloud Console](https://console.cloud.google.com/))

## Instalação

```bash
# Instalar dependências
npm install

# Copiar e preencher as variáveis de ambiente
cp .env.example .env.local

# Aplicar as migrations no banco
npm run db:migrate

# Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# Banco de dados (Neon)
DATABASE_URL=postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# NextAuth
NEXTAUTH_SECRET=        # string aleatória (ex: openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000

# Opcional: bloqueia novos cadastros (usuários existentes continuam entrando)
# BLOCK_SIGNIN=true

# Email do administrador (acesso à rota /admin)
ADMIN_EMAIL=

# Segredo para autenticar chamadas de cron jobs (Vercel Cron)
CRON_SECRET=
```

### Como obter cada variável

**DATABASE_URL** — Crie um projeto no [Neon](https://neon.tech/), vá em _Connection Details_ e copie a connection string.

**GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** — No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto, habilite a _Google+ API_, vá em _Credenciais > Criar credencial > ID do cliente OAuth_ e adicione `http://localhost:3000/api/auth/callback/google` como URI de redirecionamento autorizado.

**NEXTAUTH_SECRET** — Gere com:

```bash
openssl rand -base64 32
```

**CRON_SECRET** — Gere com o mesmo comando acima. Usado para autenticar as rotas de cron jobs da Vercel.

## Comandos disponíveis

```bash
npm run dev               # servidor de desenvolvimento
npm run build             # build de produção
npm run start             # inicia o build de produção
npm run lint              # ESLint via next lint
npm run format            # formata todos os arquivos com Prettier
npm run format:check      # verifica formatação sem alterar arquivos
npm run typecheck         # verificação de tipos TypeScript
npm run db:generate       # gera migration a partir de mudanças no schema
npm run db:migrate        # aplica migrations pendentes
npm run db:studio         # abre o Drizzle Studio (browser do banco)
npm test                  # roda testes unitários (Vitest)
npm run test:watch        # testes em modo watch
npm run test:coverage     # cobertura de testes
npm run test:integration  # testes de integração (requer variáveis Neon)
```

## Estrutura de páginas

| Rota                | Descrição                                        |
| ------------------- | ------------------------------------------------ |
| `/login`            | Autenticação via Google                          |
| `/dashboard`        | Visão geral do mês                               |
| `/registro`         | Lançamento de transações                         |
| `/categorias`       | Gerenciamento de grupos e categorias             |
| `/contas`           | Gerenciamento de contas de pagamento             |
| `/configuracao-mes` | Configurações do mês de referência               |
| `/parcelas`         | Controle de parcelamentos                        |
| `/investimentos`    | Acompanhamento de investimentos                  |
| `/metas`            | Metas financeiras                                |
| `/panorama`         | Visão anual                                      |
| `/devedores`        | Controle de cobranças e devedores                |
| `/historico`        | Histórico de transações                          |
| `/admin`            | Painel administrativo (restrito a `ADMIN_EMAIL`) |
