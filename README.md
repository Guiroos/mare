# Maré

Aplicativo de finanças pessoais para acompanhar transações, gastos fixos, parcelamentos, investimentos e metas por mês de referência.

## Tecnologias

- [Next.js 14](https://nextjs.org/) (App Router)
- [Drizzle ORM](https://orm.drizzle.team/) + [Neon](https://neon.tech/) (PostgreSQL serverless)
- [NextAuth v4](https://next-auth.js.org/) com Google OAuth
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)

## Pré-requisitos

- Node.js >= 22.0.0
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

# Whitelist de emails autorizados (separados por vírgula)
ALLOWED_EMAILS=email1@exemplo.com,email2@exemplo.com
```

### Como obter cada variável

**DATABASE_URL** — Crie um projeto no [Neon](https://neon.tech/), vá em _Connection Details_ e copie a connection string.

**GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** — No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto, habilite a _Google+ API_, vá em _Credenciais > Criar credencial > ID do cliente OAuth_ e adicione `http://localhost:3000/api/auth/callback/google` como URI de redirecionamento autorizado.

**ALLOWED_EMAILS** — Lista de emails separados por vírgula que têm acesso ao app. Qualquer conta Google que não esteja na lista será bloqueada no login.

**NEXTAUTH_SECRET** — Gere com:

```bash
openssl rand -base64 32
```

## Comandos disponíveis

```bash
npm run dev           # servidor de desenvolvimento
npm run build         # build de produção
npm run start         # inicia o build de produção
npm run lint          # ESLint via next lint
npm run format        # formata todos os arquivos com Prettier
npm run format:check  # verifica formatação sem alterar arquivos
npm run db:generate   # gera migration a partir de mudanças no schema
npm run db:migrate    # aplica migrations pendentes
npm run db:studio     # abre o Drizzle Studio (browser do banco)
```

## Estrutura de páginas

| Rota                | Descrição                            |
| ------------------- | ------------------------------------ |
| `/login`            | Autenticação via Google              |
| `/dashboard`        | Visão geral do mês                   |
| `/registro`         | Lançamento de transações             |
| `/categorias`       | Gerenciamento de categorias e contas |
| `/parcelas`         | Controle de parcelamentos            |
| `/investimentos`    | Acompanhamento de investimentos      |
| `/metas`            | Metas financeiras                    |
| `/panorama`         | Visão anual                          |
| `/configuracao-mes` | Configurações do mês de referência   |
