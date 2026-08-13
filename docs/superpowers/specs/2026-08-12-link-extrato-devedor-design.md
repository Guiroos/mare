# Link público de extrato do devedor

**Data:** 2026-08-12
**Escopo:** V1 — link de leitura, sem login, para uma pessoa consultar o que deve.

---

## Problema

Hoje a cobrança termina no WhatsApp: `CobrancaDialog` monta uma mensagem via
`buildDebtMessage(name, charges, pixKey)` e a pessoa recebe um texto estático. Se ela quiser
conferir de novo depois, ou o que mudou desde a última cobrança, precisa pedir. O caso concreto
que originou isso é de uso diário entre duas pessoas que se cobram mutuamente.

A mensagem do WhatsApp vira uma página viva: mesmo conteúdo, sempre atualizado, num link que a
pessoa salva.

## Decisões tomadas e o que ficou de fora

| Decisão | Escolha | Alternativa rejeitada |
| --- | --- | --- |
| Conteúdo | só o que está em aberto | extrato completo com histórico e gráfico |
| Ciclo do link | permanente por pessoa, revogável por rotação | expiração por tempo ou ociosidade |
| Interação | leitura pura + copiar PIX | botão "já paguei" que sinaliza ao dono |
| Criação | ação explícita na página da pessoa | link embutido automaticamente no `CobrancaDialog` |
| Token no banco | hash para lookup + cifrado para re-exibir | texto puro, ou só hash |

**Fora de escopo (V2):** espelho bilateral entre dois usuários do Maré — ligar `people.id` a
`users.id` para que cada um veja o que o outro lançou contra si. É outro objeto de domínio
(convite entre contas, não link de leitura) e não é destravado por este trabalho. Registrado aqui
para que não seja redescoberto como requisito.

## Modelo de dados

Duas colunas nullable em `people` — o link só existe depois de gerado:

```ts
shareTokenHash: text('share_token_hash'),  // SHA-256 hex; uniqueIndex
shareToken: text('share_token'),           // token cifrado com a DEK do dono
```

Token: 32 bytes de `crypto.randomBytes`, codificado em base64url (43 chars). URL: `/e/<token>`.

**Por que duas colunas.** O lookup precisa ser determinístico, e AES-GCM com IV aleatório não é —
daí o hash. Mas o hash é irreversível, e sem o valor original o dono não consegue reabrir a página
e recopiar a mesma URL. A coluna cifrada resolve isso sem devolver o token a um dump do banco: um
vazamento entrega um hash inútil e um ciphertext que exige a MEK, que mora em env. Guardar o token
em texto puro seria o único dado do banco capaz de abrir conteúdo sozinho, furando a propriedade
que `.claude/crypto.md` mantém no resto do sistema.

Não existe estado "revogado": um token substituído já é inválido por não bater com nenhum hash.
`ON DELETE cascade` de `people` limpa tudo quando a pessoa é excluída.

**Migration:** `db:generate` + `npx prettier --write lib/db/migrations/meta/`. Nenhum backfill —
as duas colunas nascem null para todas as linhas existentes.

## Rota pública

`app/(share)/e/[token]/page.tsx`, em route group novo.

Não pode ficar em `(app)`: aquele layout chama `auth()` e monta `Sidebar`/`BottomNav`. Não pode
ficar em `(marketing)`: aquele força `.theme-light` e traz o `MarketingFooter` da landing. O
layout de `(share)` é mínimo — sem nav, sem provider de tema, sem `PrivacyMode`.

Fluxo:

1. valida o formato do token com Zod (`z.string().regex(/^[A-Za-z0-9_-]{43}$/)`) **antes** de
   tocar no banco — string crua de URL não vai direto para query (mesma classe da issue #33);
2. `getSharedDebtStatement(tokenHash)` em `lib/queries/debtors.ts`;
3. `notFound()` quando devolve `null`.

A query nova encapsula os dois passos e é o único ponto que conhece o token:

```ts
export async function getSharedDebtStatement(tokenHash: string): Promise<SharedDebtStatement | null>
```

Ela busca `id, userId, name` em `people` por `shareTokenHash`, e com o `userId` **da linha
encontrada** chama `getOpenChargesForPerson(userId, personId)` e `getUserPixKey(userId)`. O nome do
dono vem de `users.name` (não cifrado, vem do Google). O `userId` nunca vem da URL — é o invariante
central desta feature.

`metadata: { robots: { index: false, follow: false } }` na página, e `/e/` no `Disallow` do
`app/robots.ts`.

Não há rate limiting: o espaço de busca de um token de 256 bits torna a enumeração inviável, e
adicionar throttle aqui protegeria contra um ataque que não existe.

## Conteúdo da página

- Cabeçalho: "Você deve para **{nome do dono}**".
- Total em aberto em destaque. É sempre o total geral, nunca o do mês filtrado — a semântica que o
  `OpenChargesPicker` já usa, e a que evita a pessoa concluir que deve menos do que deve.
- Chave PIX com botão de copiar, quando existe.
- Lista de cobranças em aberto agrupada por mês, com `Select` de mês que só aparece quando há mais
  de um, mais a opção "Todos".

O agrupamento usa `entryDate.slice(0, 7)`, replicando o que `getUniqueMonths` faz em
`components/devedores/OpenChargesPicker.tsx:18` — **não** `referenceMonth`. Consequência: o mês que
a pessoa vê é o mesmo que o dono vê no dialog de cobrança. Nenhuma mudança de query é necessária,
porque `getOpenChargesForPerson` já devolve `entryDate`.

Saldo zero renderiza `EmptyState` "Nada em aberto", não 404. Um link válido que passa a dar erro
quando a dívida é quitada gera uma dúvida pior que a página vazia.

## Lado do dono

Item "Compartilhar extrato" no `DevedorDetailActions` (kebab já existente em `/devedores/[id]`).
Abre `Dialog` no desktop e `Drawer` no mobile, com a URL visível, botão de copiar e um "Gerar novo
link" secundário — sem confirmação. Se o token ainda não existe, é gerado na abertura.

**Por que dialog e não copiar direto para o clipboard:** `navigator.clipboard.writeText()` chamado
depois de um `await` da server action perde o gesto do usuário no Safari iOS e falha em silêncio —
exatamente o aparelho onde isso será usado. Com o dialog, o clique de copiar é o próprio gesto.

Server action em `lib/actions/debtors.ts`:

```ts
generateShareLink(personId: string): Promise<{ url: string }>
```

`requireUserId()` → `assertOwnsPerson(userId, personId)` → gera token → grava hash + cifrado →
`revalidatePath('/devedores/[id]')`. **Não** revalida `/panorama`: não altera dado financeiro.

Uma segunda action `getShareLink(personId)` não é necessária — a página da pessoa já é Server
Component e pode decriptar `shareToken` na própria query de detalhe, passando a URL como prop.

## Erros

- Token com formato inválido ou inexistente: `notFound()`. Não distinguir os dois casos na resposta.
- Falha ao gerar link: a action lança, e o dialog mantém-se aberto com mensagem genérica — falha de
  rede não vira afirmação sobre a causa (`.claude/audit.md`, categoria 4).
- O dialog fecha apenas no `try`, nunca no `catch`.

## Testes

Integração, em `__tests__/integration/`, seguindo o padrão de dynamic import de `.claude/testing.md`:

1. token válido devolve as cobranças em aberto do dono correto, decriptadas;
2. token inexistente devolve `null`;
3. **token da pessoa A não devolve cobranças da pessoa B** — este é o caso que só a implementação
   correta passa. A versão errada mais provável é derivar `personId` (ou `userId`) de outro lugar
   que não a linha encontrada pelo hash; um teste com uma pessoa só passaria igual nos dois casos;
4. `generateShareLink` chamado duas vezes invalida o hash anterior — o token antigo deixa de
   resolver;
5. `generateShareLink` para pessoa de outro usuário é rejeitado por `assertOwnsPerson`, usando
   `FOREIGN_UUID` para passar a validação de schema e chegar ao ownership check.

Unitário: geração do token (comprimento, alfabeto base64url) e o hash sendo estável para a mesma
entrada.

## Custo

M — `lib/db/schema.ts` + migration, `lib/queries/debtors.ts`, `lib/actions/debtors.ts`,
`app/(share)/` (layout + page + componentes da página), `DevedorDetailActions`, `app/robots.ts`.
