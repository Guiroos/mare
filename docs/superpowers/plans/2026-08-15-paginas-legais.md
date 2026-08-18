# Páginas legais da landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir `/privacidade`, `/termos` e `/seguranca` no grupo `(marketing)`, fechando o último item da §6.1 do backlog que bloqueia abrir cadastro público.

**Architecture:** Uma casca de prosa compartilhada (`LegalPage` + `LegalSection`) serve as duas páginas jurídicas; a `/seguranca` é página de marketing e usa as primitivas da landing. Todas estáticas, sem `auth()`, cada uma com `metadata` e `alternates.canonical` próprios. O fechamento é a integração: links no rodapé, rotas no sitemap, e um teste que amarra os três.

**Tech Stack:** Next.js 16 (App Router, RSC estáticos), Tailwind com tokens `mkt-*`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-paginas-legais-design.md`

## Global Constraints

- **Dois valores pendentes bloqueiam a publicação, não a implementação.** `placeholder@email.com` e `[NOME COMPLETO]` entram literalmente no código agora. O Task 4 adiciona um teste que **falha** se qualquer um dos dois sobreviver junto com as rotas no sitemap — é o que impede a página ir ao ar prometendo um canal que não existe.
- **Sem dependência nova.** Nada de `next-mdx-remote` nem de biblioteca de render de markdown.
- **Sem infra de teste nova.** O projeto não tem jsdom nem testing-library; testes de componente leem o texto-fonte do arquivo (`__tests__/unit/row-actions.test.ts` é a referência do padrão).
- **`components/marketing/` está fora do `ds-reviewer`** (§5.7 do backlog) — as primitivas de marketing não seguem `.claude/ds-components.md`.
- **Toda página declara `alternates.canonical` próprio.** O root layout não declara (§4.5 do backlog); herdar `/` faria as três se anularem no índice.
- **Região confirmada:** Neon `sa-east-1` (São Paulo), Vercel `gru1` (Guarulhos). O texto afirma que banco e aplicação ficam no Brasil.
- **Gates antes de qualquer commit:** `npm run lint && npm run format:check && npm run typecheck && npm test`.

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `components/marketing/LegalPage.tsx` | Casca de prosa: cabeçalho, data de atualização, coluna de leitura, `LegalSection` ancorada |
| `app/(marketing)/privacidade/page.tsx` | Conteúdo da Política de Privacidade |
| `app/(marketing)/termos/page.tsx` | Conteúdo dos Termos de Uso |
| `app/(marketing)/seguranca/page.tsx` | Página de segurança (primitivas da landing, não `LegalPage`) |
| `components/marketing/MarketingFooter.tsx` | Modificar: restaurar os três links |
| `app/sitemap.ts` | Modificar: acrescentar as três rotas |
| `__tests__/unit/paginas-publicas.test.ts` | Gate: sitemap ↔ rotas ↔ rodapé ↔ canonical ↔ pendências |

---

### Task 1: Casca de prosa + /privacidade

**Files:**
- Create: `components/marketing/LegalPage.tsx`
- Create: `app/(marketing)/privacidade/page.tsx`

**Interfaces:**
- Consumes: `cn` de `@/lib/utils/cn`.
- Produces: `LegalPage({ title, updatedAt, intro, children })` e `LegalSection({ id, title, children })`, consumidos pelo Task 2.

- [ ] **Step 1: Criar a casca**

Criar `components/marketing/LegalPage.tsx`:

```tsx
/**
 * Casca das páginas jurídicas (/privacidade, /termos).
 *
 * A data de atualização é obrigatória e fica no topo: a LGPD pede que mudanças
 * de política sejam rastreáveis, e sem versionamento histórico (fora de escopo
 * enquanto não há usuário pagante) a data é o único rastro que existe.
 *
 * `LegalSection` numera e ancora cada seção porque política é documento que se
 * cita por link — âncora estável vale mais aqui do que na landing.
 */
export function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string
  updatedAt: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-[720px] px-5 pb-24 pt-14 sm:px-8 lg:px-10">
      <h1 className="text-mkt-h2 font-semibold tracking-tight text-text-primary">{title}</h1>
      <p className="mt-3 font-mono text-mkt-micro uppercase text-text-tertiary">
        Atualizada em {updatedAt}
      </p>
      <p className="mt-6 text-mkt-lead text-text-secondary">{intro}</p>
      <div className="mt-12 space-y-11">{children}</div>
    </article>
  )
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-mkt-h3 font-semibold tracking-tight text-text-primary">{title}</h2>
      <div className="mt-4 space-y-4 text-mkt-body text-text-secondary [&_a]:text-accent-text [&_a]:underline [&_li]:mt-2 [&_strong]:font-semibold [&_strong]:text-text-primary [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Escrever a página de privacidade**

Criar `app/(marketing)/privacidade/page.tsx` com exatamente este conteúdo:

```tsx
import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Maré',
  description:
    'O que o Maré coleta, o que é criptografado, com quem compartilha e como apagar tudo. Banco de dados e aplicação hospedados no Brasil.',
  alternates: { canonical: '/privacidade' },
}

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      updatedAt="15 de agosto de 2026"
      intro="Esta política diz o que o Maré guarda, o que é criptografado, com quem compartilha e o que você pode fazer a respeito. Ela é específica de propósito: em vez de prometer que “seus dados estão seguros”, ela nomeia os campos, o algoritmo e as exceções."
    >
      <LegalSection id="controlador" title="1. Quem responde por estes dados">
        <p>
          O Maré é operado por <strong>[NOME COMPLETO]</strong>, pessoa física, na condição de
          controlador dos seus dados pessoais nos termos da Lei 13.709/2018 (LGPD).
        </p>
        <p>
          Contato para qualquer assunto desta política, inclusive para exercer os direitos da
          seção 8: <a href="mailto:placeholder@email.com">placeholder@email.com</a>.
        </p>
      </LegalSection>

      <LegalSection id="coleta" title="2. O que é coletado">
        <p>Três origens, e nenhuma outra.</p>
        <ul>
          <li>
            <strong>Do seu login Google:</strong> nome, endereço de e-mail e foto de perfil. O
            Maré não pede senha e não tem como obtê-la.
          </li>
          <li>
            <strong>Do que você digita:</strong> lançamentos, categorias, contas de pagamento,
            parcelas, investimentos, metas, devedores e as anotações que você fizer.
          </li>
          <li>
            <strong>Gerado automaticamente:</strong> data de criação da conta e dos registros e,
            se você enviar feedback, a rota de onde ele partiu.
          </li>
        </ul>
        <p>
          Não há coleta de dados bancários. O Maré não usa Open Finance, não pede credencial de
          banco e não lê extrato — como não existe essa conexão, não existe esse dado.
        </p>
      </LegalSection>

      <LegalSection id="criptografia" title="3. O que é criptografado e o que não é">
        <p>
          Os campos com conteúdo financeiro ou pessoal são criptografados individualmente antes de
          chegar ao banco, com <strong>AES-256-GCM</strong> e uma chave distinta para cada usuário.
          Isso cobre valores, descrições, nomes de categoria, de conta e de pessoa, telefones,
          e-mails de devedores, anotações, metas, investimentos e mensagens de feedback.
        </p>
        <p>
          Ficam <strong>sem criptografia</strong> o seu nome e o seu e-mail, porque o login precisa
          procurar por eles para te reconhecer, além das datas de criação e dos identificadores
          internos dos registros.
        </p>
        <p>
          A consequência prática é a que importa: uma cópia bruta do banco não entrega seus
          valores. As linhas estão lá; o conteúdo delas, não.
        </p>
      </LegalSection>

      <LegalSection id="base-legal" title="4. Com que fundamento">
        <p>
          O tratamento dos dados da sua conta e dos seus lançamentos se dá para{' '}
          <strong>execução do contrato</strong> (art. 7º, V da LGPD) — sem eles não existe o
          serviço. A medição de audiência das páginas públicas se dá por{' '}
          <strong>legítimo interesse</strong> (art. 7º, IX).
        </p>
        <p>
          Nada aqui depende do seu consentimento, e é por isso que o Maré não exibe janela de
          cookies: não há o que consentir.
        </p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="5. Com quem os dados são compartilhados">
        <p>Três fornecedores de infraestrutura, cada um com um papel restrito:</p>
        <ul>
          <li>
            <strong>Google</strong> — autenticação. Recebe apenas o necessário para confirmar que
            você é você. É o Google que valida sua senha, não o Maré.
          </li>
          <li>
            <strong>Neon</strong> — banco de dados. Armazena os registros, em sua maioria
            criptografados conforme a seção 3.
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem da aplicação e medição de audiência das páginas
            públicas.
          </li>
        </ul>
        <p>
          Nenhum deles recebe seus dados para uso próprio. Não há venda, aluguel nem
          compartilhamento com anunciantes, corretoras, bureaus de crédito ou qualquer terceiro
          fora desta lista.
        </p>
      </LegalSection>

      <LegalSection id="localizacao" title="6. Onde os dados ficam">
        <p>
          O banco de dados fica em <strong>São Paulo</strong> e a aplicação roda em{' '}
          <strong>Guarulhos</strong>. Seus lançamentos não saem do Brasil.
        </p>
        <p>
          Há transferência internacional em dois pontos, ambos limitados: o login passa pelo
          Google, e a medição de audiência das páginas públicas é processada pela Vercel fora do
          país. Nenhum dos dois envolve seus dados financeiros.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="7. Cookies">
        <p>
          O Maré usa <strong>um</strong> cookie, o de sessão, que mantém você conectado. É
          essencial: sem ele não há como permanecer autenticado entre páginas.
        </p>
        <p>
          A medição de audiência não usa cookies e não acompanha você entre sites — ela conta
          visitas, origem e tipo de dispositivo, sem identificar quem você é.
        </p>
      </LegalSection>

      <LegalSection id="direitos" title="8. Seus direitos">
        <p>
          A LGPD garante confirmação de tratamento, acesso, correção, portabilidade, eliminação e
          informação sobre compartilhamento (art. 18). Dois deles não dependem de você pedir nada
          a ninguém:
        </p>
        <ul>
          <li>
            <strong>Exportar tudo</strong> — em Configurações, você baixa a conta inteira em
            planilha ou CSV, a qualquer momento.
          </li>
          <li>
            <strong>Apagar tudo</strong> — também em Configurações, e o efeito é imediato. Veja a
            seção 10.
          </li>
        </ul>
        <p>
          Para os demais direitos, escreva para{' '}
          <a href="mailto:placeholder@email.com">placeholder@email.com</a>.
        </p>
      </LegalSection>

      <LegalSection id="terceiros" title="9. Dados de outras pessoas">
        <p>
          A seção de devedores permite registrar quem te deve — nome, telefone, valores e
          anotações. Essas pessoas não são usuárias do Maré e não concordaram com nada.
        </p>
        <p>
          Nesse caso, <strong>quem decide sobre aquele dado é você</strong>: você determina o que
          cadastrar, por quanto tempo manter e se vai gerar um link público de extrato. O Maré
          apenas armazena, na condição de operador. O link público, quando você o cria, torna
          aquele extrato acessível a qualquer pessoa que tenha a URL — e você pode revogá-lo
          quando quiser.
        </p>
        <p>
          Se você é uma dessas pessoas e quer que seus dados sejam removidos, procure quem fez o
          cadastro. Se isso não for possível, escreva para{' '}
          <a href="mailto:placeholder@email.com">placeholder@email.com</a>.
        </p>
      </LegalSection>

      <LegalSection id="retencao" title="10. Por quanto tempo">
        <p>
          Seus dados existem enquanto a sua conta existir. Quando você a exclui, a remoção é
          imediata e definitiva: não há lixeira, não há período de carência e não fica cópia
          “anonimizada” para estatística.
        </p>
        <p>
          Backups operacionais do banco expiram sozinhos em até 30 dias. Se quiser guardar seu
          histórico, exporte antes de excluir — depois não há como recuperar.
        </p>
      </LegalSection>

      <LegalSection id="alteracoes" title="11. Alterações nesta política">
        <p>
          Mudanças passam a valer na data indicada no topo. Se alguma alterar de forma relevante o
          que é coletado ou com quem é compartilhado, o aviso virá no próprio aplicativo, antes de
          entrar em vigor.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
```

- [ ] **Step 3: Rodar os gates**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: os três passam. Se o Prettier reclamar, rodar `npx prettier --write` nos dois arquivos criados e repetir.

- [ ] **Step 4: Conferir que a rota responde**

Run: `npm run build 2>&1 | grep -E "privacidade|Error"`
Expected: `/privacidade` aparece na listagem de rotas como estática (`○`). Nenhum erro.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/LegalPage.tsx "app/(marketing)/privacidade/page.tsx"
git commit -m "feat: add privacy policy page"
```

---

### Task 2: /termos

**Files:**
- Create: `app/(marketing)/termos/page.tsx`

**Interfaces:**
- Consumes: `LegalPage` e `LegalSection` do Task 1.
- Produces: rota `/termos`, consumida pelos Tasks 4 (rodapé, sitemap, teste).

- [ ] **Step 1: Escrever a página**

Criar `app/(marketing)/termos/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Termos de Uso — Maré',
  description:
    'As regras de uso do Maré: o que ele é e o que não é, o que é gratuito, suas responsabilidades e como encerrar a conta.',
  alternates: { canonical: '/termos' },
}

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      updatedAt="15 de agosto de 2026"
      intro="Ao usar o Maré você concorda com o que está aqui. São poucas regras, e a maior parte delas existe para deixar claro o que o Maré não faz."
    >
      <LegalSection id="o-que-e" title="1. O que o Maré é">
        <p>
          O Maré é uma ferramenta para registrar e organizar finanças pessoais. Você anota o que
          entrou e o que saiu, e ele mostra o quadro.
        </p>
        <p>
          O Maré <strong>não é consultoria financeira</strong> e não recomenda investimento. Ele
          não executa transação, não movimenta dinheiro, não se conecta ao seu banco e não tem
          qualquer acesso às suas contas. As decisões sobre o seu dinheiro são suas, e o resultado
          delas também.
        </p>
      </LegalSection>

      <LegalSection id="quem-pode" title="2. Quem pode usar">
        <p>
          Você precisa ter 18 anos ou mais e uma conta Google válida. Uma conta do Maré pertence a
          uma pessoa — os dados são pessoais e não foram desenhados para uso compartilhado.
        </p>
      </LegalSection>

      <LegalSection id="custo" title="3. Quanto custa">
        <p>
          O Maré é <strong>gratuito</strong>. Não há plano pago, cobrança escondida nem período de
          teste que vira assinatura.
        </p>
        <p>
          Se um dia isso mudar, você será avisado com antecedência e{' '}
          <strong>nada será cobrado sem que você aceite</strong>. Quem não aceitar continua podendo
          exportar tudo e encerrar a conta.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidades" title="4. Suas responsabilidades">
        <ul>
          <li>
            <strong>Sua conta Google é a única porta de entrada.</strong> Quem tiver acesso a ela
            tem acesso ao seu Maré. Mantenha-a protegida.
          </li>
          <li>
            <strong>Dados de outras pessoas.</strong> Ao cadastrar um devedor, você declara ter
            motivo legítimo para tratar aquele dado e responde por ele. O mesmo vale ao gerar um
            link público de extrato: a decisão de expor é sua, e o link é acessível a quem tiver a
            URL.
          </li>
          <li>
            <strong>O que você registra.</strong> O Maré não confere nem corrige o que você digita.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="vedacoes" title="5. O que você não pode fazer">
        <ul>
          <li>Tentar acessar dados de outro usuário, por qualquer meio.</li>
          <li>Automatizar acesso ao serviço, raspar conteúdo ou sobrecarregar a infraestrutura.</li>
          <li>Revender o acesso ou oferecer o Maré como se fosse serviço seu.</li>
        </ul>
      </LegalSection>

      <LegalSection id="disponibilidade" title="6. Disponibilidade">
        <p>
          O Maré é oferecido “como está”, sem garantia de disponibilidade. É um serviço gratuito
          mantido por uma pessoa: pode sair do ar para manutenção, apresentar falhas ou ser
          descontinuado.
        </p>
        <p>
          <strong>Se for descontinuado, você será avisado com antecedência razoável e a exportação
          continuará funcionando até o último dia.</strong> Seu histórico não fica preso aqui.
        </p>
      </LegalSection>

      <LegalSection id="encerramento" title="7. Encerramento">
        <p>
          Você pode excluir sua conta a qualquer momento, em Configurações. A exclusão é imediata e
          irreversível — exporte antes se quiser guardar o histórico.
        </p>
        <p>
          Contas que violem estes termos, especialmente a seção 5, podem ser encerradas. Sempre que
          possível, com aviso prévio.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidade" title="8. Limitação de responsabilidade">
        <p>
          O Maré organiza informação que você mesmo registrou. Não há responsabilidade por decisões
          financeiras tomadas a partir do que ele exibe, por perda de dados decorrente de exclusão
          feita por você, nem por indisponibilidade do serviço.
        </p>
        <p>
          Isso não afasta as responsabilidades que a lei brasileira não permite afastar, inclusive
          as do Código de Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection id="foro" title="9. Lei aplicável">
        <p>
          Estes termos são regidos pela lei brasileira. Fica eleito o foro do domicílio do usuário
          para qualquer questão que deles decorra.
        </p>
        <p>
          Dúvidas: <a href="mailto:placeholder@email.com">placeholder@email.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
```

- [ ] **Step 2: Rodar os gates**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: passam.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/termos/page.tsx"
git commit -m "feat: add terms of use page"
```

---

### Task 3: /seguranca

**Files:**
- Create: `app/(marketing)/seguranca/page.tsx`

**Interfaces:**
- Consumes: `Eyebrow` e `MarketingButton` de `@/components/marketing/`.
- Produces: rota `/seguranca`.

Não usa `LegalPage`: é página de marketing, com o tom da landing. Quatro blocos, sem seção de limites (decisão registrada no spec).

- [ ] **Step 1: Escrever a página**

Criar `app/(marketing)/seguranca/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { Eyebrow } from '@/components/marketing/Eyebrow'
import { MarketingButton } from '@/components/marketing/MarketingButton'

export const metadata: Metadata = {
  title: 'Segurança — Maré',
  description:
    'Como o Maré protege seus dados: sem conexão bancária, campos criptografados com chave por usuário e exclusão que apaga de verdade.',
  alternates: { canonical: '/seguranca' },
}

const BLOCKS = [
  {
    eyebrow: 'Acesso',
    title: 'Seu banco continua sendo seu',
    body: 'O Maré não usa Open Finance, não pede credencial bancária e não lê extrato. Você registra o que gastou; ele organiza. Como nunca houve acesso à sua conta, não existe cenário em que o Maré movimente seu dinheiro — nem por falha, nem por invasão.',
  },
  {
    eyebrow: 'Criptografia',
    title: 'Uma chave para cada usuário',
    body: 'Valores, descrições, nomes de categoria e de pessoas, telefones e anotações são criptografados um a um com AES-256-GCM, e cada conta tem sua própria chave. A consequência é a que importa: uma cópia bruta do banco não entrega seus valores. As linhas estão lá; o conteúdo delas, não.',
  },
  {
    eyebrow: 'Exclusão',
    title: 'Apagar apaga de verdade',
    body: 'Ao excluir a conta, tudo sai na hora: lançamentos, categorias, devedores, metas e o próprio cadastro. Não há lixeira, não há período de carência e não fica cópia “anonimizada” para estatística. Por isso a exportação completa fica ao lado do botão — leve seu histórico antes.',
  },
  {
    eyebrow: 'Hospedagem',
    title: 'Os dados ficam no Brasil',
    body: 'O banco de dados roda em São Paulo e a aplicação em Guarulhos. Seus lançamentos não saem do país; o que atravessa fronteira é apenas o login, que passa pelo Google, e a contagem de visitas das páginas públicas.',
  },
]

export default function SegurancaPage() {
  return (
    <div className="mx-auto max-w-[880px] px-5 pb-24 pt-14 sm:px-8 lg:px-10">
      <Eyebrow>Segurança</Eyebrow>
      <h1 className="text-mkt-h2 font-semibold tracking-tight text-text-primary">
        O que protege seus dados aqui
      </h1>
      <p className="mt-5 max-w-[620px] text-mkt-lead text-text-secondary">
        Todo aplicativo financeiro diz que é seguro. Esta página diz como — em termos que você pode
        conferir, e sem prometer nada que o código não faça.
      </p>

      <div className="mt-14 space-y-11">
        {BLOCKS.map((block) => (
          <section key={block.title} className="border-t border-border pt-7">
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h2 className="text-mkt-h3 font-semibold tracking-tight text-text-primary">
              {block.title}
            </h2>
            <p className="mt-3 max-w-[620px] text-mkt-body text-text-secondary">{block.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-14 border-t border-border pt-7">
        <Eyebrow>Encontrou algo</Eyebrow>
        <h2 className="text-mkt-h3 font-semibold tracking-tight text-text-primary">
          Como reportar um problema
        </h2>
        <p className="mt-3 max-w-[620px] text-mkt-body text-text-secondary">
          Se você encontrou uma falha de segurança, escreva para{' '}
          <a className="text-accent-text underline" href="mailto:placeholder@email.com">
            placeholder@email.com
          </a>
          . Não há programa de recompensa, mas há resposta: todo relato é lido e respondido.
        </p>
        <div className="mt-7">
          <MarketingButton href="/login">Criar conta</MarketingButton>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Rodar os gates**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: passam.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/seguranca/page.tsx"
git commit -m "feat: add security page"
```

---

### Task 4: Integração e gate

As páginas existem mas ninguém chega nelas. Esta task fecha o circuito e adiciona o teste que impede a regressão silenciosa.

**Files:**
- Create: `__tests__/unit/paginas-publicas.test.ts`
- Modify: `components/marketing/MarketingFooter.tsx`
- Modify: `app/sitemap.ts`
- Modify: `docs/seo-landing-backlog.md`

**Interfaces:**
- Consumes: as três rotas dos Tasks 1–3.

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/unit/paginas-publicas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Integridade das páginas públicas ──────────────────────────────────────
//
// Não há infra de render de componente no projeto (sem jsdom/testing-library),
// então a asserção é sobre o texto-fonte — mesmo padrão de row-actions.test.ts.
//
// O que este teste pega, e nenhuma outra checagem pega:
//   1. Página pública nova que ninguém acrescentou ao sitemap. Lighthouse dá
//      100 em SEO com o sitemap incompleto — ele não sabe o que falta.
//   2. Página sem `alternates.canonical` próprio. O root layout não declara
//      (§4.5 do backlog): quem esquecer não é sinalizado por gate nenhum, e a
//      página se anula no índice.
//   3. Link do rodapé apontando para rota que não existe — 404 na letra miúda.
//   4. Publicação com os valores pendentes ainda no texto.
//
// A entrada que só a correção certa rejeita é a #4: um teste que apenas
// contasse rotas passaria com `placeholder@email.com` no ar.

// `process.cwd()` é a convenção dos testes existentes que leem fonte
// (dependencies.test.ts:11, row-actions.test.ts:18) — não trocar por
// `import.meta.dirname`, que é o padrão dos arquivos `.mts` de config.
const ROOT = process.cwd()
const MARKETING = join(ROOT, 'app/(marketing)')

function publicRoutes(): string[] {
  return readdirSync(MARKETING, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/${entry.name}`)
}

const sitemapSrc = readFileSync(join(ROOT, 'app/sitemap.ts'), 'utf-8')
const footerSrc = readFileSync(join(ROOT, 'components/marketing/MarketingFooter.tsx'), 'utf-8')

describe('páginas públicas', () => {
  it('toda rota do grupo (marketing) está no sitemap', () => {
    for (const route of publicRoutes()) {
      expect(sitemapSrc, `${route} não está em app/sitemap.ts`).toContain(route)
    }
  })

  it('toda rota do grupo (marketing) declara canonical próprio', () => {
    for (const route of publicRoutes()) {
      const src = readFileSync(join(MARKETING, route.slice(1), 'page.tsx'), 'utf-8')
      expect(src, `${route} não declara alternates.canonical`).toContain(
        `canonical: '${route}'`
      )
    }
  })

  it('todo link interno do rodapé aponta para rota existente', () => {
    const hrefs = [...footerSrc.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1])
    const known = ['/', ...publicRoutes()]
    for (const href of hrefs) {
      expect(known, `rodapé aponta para ${href}, que não existe`).toContain(href)
    }
  })

  it('as três páginas legais estão no ar', () => {
    expect(publicRoutes().sort()).toEqual(['/privacidade', '/seguranca', '/termos'])
  })

  it('nenhum valor pendente sobreviveu à publicação', () => {
    for (const route of publicRoutes()) {
      const src = readFileSync(join(MARKETING, route.slice(1), 'page.tsx'), 'utf-8')
      expect(src, `${route} ainda tem e-mail placeholder`).not.toContain('placeholder@email.com')
      expect(src, `${route} ainda tem nome placeholder`).not.toContain('[NOME COMPLETO]')
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha pelos motivos certos**

Run: `npx vitest run __tests__/unit/paginas-publicas.test.ts`
Expected: FAIL. Três casos falham — sitemap sem as rotas, rodapé sem links, e o de valores pendentes. O caso "as três páginas legais estão no ar" **passa**, porque os Tasks 1–3 já as criaram.

O caso de valores pendentes vai continuar vermelho até o e-mail e o nome definitivos entrarem. Isso é o comportamento desejado: é ele que impede publicar prometendo um canal inexistente.

- [ ] **Step 3: Acrescentar as rotas ao sitemap**

Em `app/sitemap.ts`, remover do comentário de bloco a linha `* Ao subir /privacidade, /termos, /seguranca e o blog, acrescentar aqui.` e substituir por `* Ao subir o blog, acrescentar aqui.`, depois acrescentar as três entradas após a entrada raiz:

```ts
    {
      url: `${SITE_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/seguranca`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
```

`/seguranca` tem prioridade maior e revisão mais frequente porque é página de conteúdo que sustenta a cunha da landing, não letra miúda.

- [ ] **Step 4: Restaurar os links no rodapé**

Reescrever `components/marketing/MarketingFooter.tsx` inteiro (o comentário de bloco atual explica a ausência dos links e sai junto):

```tsx
import Link from 'next/link'

const LINKS = [
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/termos', label: 'Termos' },
  { href: '/seguranca', label: 'Segurança' },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border pb-14 pt-11 text-[14px] text-text-tertiary">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-3.5 px-5 sm:px-8 lg:px-10">
        <p>Maré · Feito no Brasil · © 2026</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="no-underline hover:text-text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 5: Rodar o teste de novo**

Run: `npx vitest run __tests__/unit/paginas-publicas.test.ts`
Expected: quatro casos passam; apenas "nenhum valor pendente sobreviveu à publicação" continua vermelho, por desenho, até os valores definitivos entrarem.

- [ ] **Step 6: Atualizar o backlog**

Em `docs/seo-landing-backlog.md`, na tabela da §6.1, marcar Política de Privacidade, Termos de Uso e Página de Segurança como resolvidas, no mesmo formato das duas linhas já resolvidas (`~~Item~~` na primeira coluna, `**resolvida**` na segunda, caminho da rota na terceira). Acrescentar após a tabela:

```markdown
As três páginas subiram em 2026-08-15. O rodapé voltou a linkar as três e o
`app/sitemap.ts` as declara. `__tests__/unit/paginas-publicas.test.ts` amarra
os três lados: rota nova sem entrada no sitemap, sem canonical próprio, ou
link de rodapé apontando para rota inexistente passam a quebrar o gate.

Fica **um** item vermelho de propósito: o teste falha enquanto o e-mail de
contato e o nome do controlador forem placeholder. É o que impede publicar uma
seção de direitos que promete um canal inexistente.
```

- [ ] **Step 7: Rodar a suíte inteira e commitar**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: tudo passa exceto o caso de valores pendentes, documentado acima.

```bash
git add __tests__/unit/paginas-publicas.test.ts app/sitemap.ts \
  components/marketing/MarketingFooter.tsx docs/seo-landing-backlog.md
git commit -m "feat: wire legal pages into footer and sitemap"
```

---

### Task 5: Substituir os valores pendentes (bloqueado)

**Não executar até o usuário fornecer os dois valores.** É a última coisa antes de publicar.

**Files:**
- Modify: `app/(marketing)/privacidade/page.tsx`, `app/(marketing)/termos/page.tsx`, `app/(marketing)/seguranca/page.tsx`

- [ ] **Step 1: Trocar os dois valores**

Run: `rg -n "placeholder@email.com|\[NOME COMPLETO\]" "app/(marketing)"`
Substituir cada ocorrência pelo e-mail definitivo e pelo nome completo do controlador. São cinco pontos de e-mail (seções 1, 8 e 9 da privacidade; seção 9 dos termos; bloco de reporte da segurança) e um de nome (seção 1 da privacidade).

- [ ] **Step 2: Confirmar que o gate fecha**

Run: `npx vitest run __tests__/unit/paginas-publicas.test.ts`
Expected: PASS nos cinco casos. Este é o sinal de que as páginas podem ir ao ar.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)"
git commit -m "chore: replace placeholder contact details on legal pages"
```
