# Páginas legais da landing — design

**Data:** 2026-08-15
**Escopo:** `/privacidade`, `/termos`, `/seguranca` em `app/(marketing)/`.
**Por que agora:** são o último item da §6.1 do `docs/seo-landing-backlog.md` que bloqueia abrir
cadastro público. Exportação completa e exclusão de conta já fecharam; estas três páginas são o
que resta.

Este documento é o roteiro do conteúdo, não o conteúdo final. Ele decide o que cada página
afirma e por quê. A redação vem depois, contra este esqueleto.

---

## Decisões tomadas

| Decisão | Escolha | Consequência |
| --- | --- | --- |
| Controlador | Pessoa física, sem CNPJ | Nome + e-mail de contato no topo da Privacidade |
| Dados de terceiros (`/devedores`) | Usuário é controlador, Maré é operador | Cláusula própria nos Termos e seção na Privacidade |
| Custo | Gratuito hoje, cobrança possível com aviso | Cláusula 3 dos Termos |
| Detalhe da `/seguranca` | Mecanismo em um parágrafo, sem lista de limites | Sem MEK/DEK, sem seção de fraquezas |
| Formato | Casca compartilhada em TSX | Sem dependência nova; texto versionado em PR |

**E-mail de contato:** `placeholder@email.com` até decisão. Aparece em cinco pontos (topo e
seção de direitos da Privacidade, encerramento dos Termos, reporte da Segurança, rodapé) —
trocar exige varrer os três arquivos.

---

## Fatos verificados no código

Escritos aqui porque o texto final vai afirmá-los publicamente, e afirmação errada em página de
privacidade é a pior classe de erro deste repo.

**Cifrado com chave por usuário** (AES-256-GCM, `lib/crypto/fields.ts`): valores, descrições,
nomes de categoria e de grupo, nomes de conta, nomes de pessoa, e-mail e telefone de devedor,
notas, metas, investimentos, mensagens de feedback. Verificado em `createPerson`
(`lib/actions/debtors.ts:41-47`) e nos 10 arquivos de `lib/actions/` que chamam `encryptField`.

**Em claro:** `users.name` e `users.email` (o login precisa procurar por eles),
`feedback.page`, carimbos de data, e a estrutura de ids.

**Subprocessadores, os três:** Google (OAuth, `lib/auth.ts`), Neon (banco), Vercel (hospedagem,
Web Analytics, Speed Insights). Nenhum outro — não há provedor de e-mail, de pagamento nem de IA
nas dependências.

**Região:** Neon em `sa-east-1` (São Paulo) e Vercel em `gru1` (Guarulhos, `vercel.json:3`).
Banco e aplicação não saem do Brasil. A transferência internacional se limita ao login do Google
e ao processamento de audiência da Vercel.

**Cookies:** só o de sessão do NextAuth. O Vercel Analytics v2 é cookieless. Não há banner de
consentimento e o documento explica por quê, em vez de silenciar.

**Exclusão:** hard delete imediato via `lib/actions/delete-account.ts` — `DELETE FROM users` com
os 19 FKs em cascade. Sem lixeira, sem retenção "anonimizada".

**Exportação:** `/api/export/completo`, 12 planilhas em `.xlsx` ou `.zip` de CSVs.

---

## Arquitetura

```
app/(marketing)/privacidade/page.tsx     ← LegalPage
app/(marketing)/termos/page.tsx          ← LegalPage
app/(marketing)/seguranca/page.tsx       ← primitivas da landing
components/marketing/LegalPage.tsx       ← casca de prosa + LegalSection
```

`LegalPage({ title, updatedAt, children })` renderiza cabeçalho, data de última atualização e a
coluna de leitura. `LegalSection({ id, title, children })` numera e ancora as seções — âncora
estável importa porque a política vai ser citada por link.

Restrições que valem para as três:

- **Estáticas.** Sem `auth()`, sem estado de cliente. O grupo `(marketing)` já é assim.
- **`metadata` própria em cada página, com `alternates.canonical` próprio.** O root layout não
  declara canonical desde a §4.5 do backlog justamente para isto; herdar `/` faria as três se
  anularem no índice.
- **`/seguranca` não usa `LegalPage`.** É página de marketing, com `Eyebrow` e `MarketingButton`.
  Tom e layout da landing, não de contrato.
- **`components/marketing/` está fora do `ds-reviewer`** (§5.7 do backlog) — as primitivas de
  marketing são próprias por decisão de brief.

---

## Conteúdo — /privacidade

Ordem conforme a LGPD.

1. **Quem responde.** Pessoa física, nome e e-mail de contato.
2. **O que é coletado**, em três blocos: o que vem do Google (nome, e-mail, foto); o que você
   digita (lançamentos, categorias, contas, devedores, metas, investimentos); o que é gerado
   sozinho (data de criação, feedback com a rota de origem).
3. **O que é cifrado e o que não é.** A lista do bloco de fatos acima, com a exceção nomeada:
   nome e e-mail ficam em claro porque o login procura por eles. Nomear a exceção é o que torna
   o resto crível.
4. **Base legal.** Execução do contrato para o essencial; legítimo interesse para medição de
   audiência. Nada depende de consentimento — daí não haver banner.
5. **Com quem é compartilhado.** Os três subprocessadores e o que cada um vê. Nenhum recebe
   dado para uso próprio.
6. **Onde os dados ficam.** Banco e aplicação em São Paulo. Transferência internacional só no
   login do Google e na audiência da Vercel.
7. **Cookies.** Só o de sessão, essencial. Analytics cookieless, sem rastreamento entre sites.
8. **Seus direitos.** Art. 18 da LGPD, e o diferencial: exportação e exclusão são
   autoatendimento em Configurações, não pedido por e-mail com prazo de 15 dias.
9. **Dados de terceiros.** Quem cadastra o devedor é o controlador daquele dado; o Maré é
   operador. Inclui o link público de extrato e o que ele expõe a quem tiver a URL.
10. **Retenção e alterações.** Dados vivem enquanto a conta existir. Mudanças na política ficam
    registradas na data de atualização do topo.

## Conteúdo — /termos

1. **O que o Maré é.** Ferramenta de registro e organização. Não é consultoria financeira, não
   executa transação, não move dinheiro.
2. **Quem pode usar.** Maior de 18, uma conta por pessoa, dados verdadeiros no login.
3. **Custo.** Gratuito hoje; se mudar, aviso antecipado e nada cobrado sem aceite.
4. **Suas responsabilidades.** Base legal para cadastrar dados de terceiros; decisão de expor
   via link público; manter a conta Google segura, já que é a única porta de entrada.
5. **Vedações.** Automatizar acesso, tentar alcançar dados de outro usuário, revender.
6. **Disponibilidade.** Sem SLA. **Compromisso explícito:** se for descontinuado, aviso com
   antecedência razoável e a exportação funciona até o fim.
7. **Encerramento.** Você apaga quando quiser, imediato e irreversível; conta que viole os
   termos pode ser encerrada.
8. **Limitação de responsabilidade, lei brasileira, foro.**

## Conteúdo — /seguranca

Quatro blocos curtos.

- **Seu banco continua sendo seu.** Sem Open Finance, sem credencial bancária, sem leitura de
  extrato. Não há como movimentar dinheiro porque nunca houve acesso a nada que permita.
- **Criptografia.** Um parágrafo: campos sensíveis cifrados individualmente com AES-256-GCM,
  chave distinta por usuário. O peso está na consequência, não no algoritmo — *um dump do banco
  não entrega seus valores*. Sem MEK/DEK, sem diagrama.
- **Exclusão apaga de verdade.** Hard delete imediato, sem lixeira, sem cópia retida.
- **Como reportar um problema.** E-mail de contato e compromisso de resposta. Sem bug bounty.

---

## Integração — fecha junto ou a página não existe

- `MarketingFooter.tsx`: restaurar os três links (o comentário de bloco na linha 4 marca o ponto
  e sai junto).
- `app/sitemap.ts`: acrescentar as três rotas; o comentário do arquivo já pede.
- `docs/seo-landing-backlog.md` §6.1: as três linhas viram resolvidas, e a tabela passa a ter
  zero pendências de conteúdo.

## Testes

O conteúdo é prosa — não há lógica a testar, e teste de string de política é ruído. O que merece
gate é o que quebra em silêncio:

- As três rotas retornam 200 e aparecem no `sitemap.ts`. Um teste que percorra o sitemap e bata
  contra as rotas existentes pega o caso real: página nova esquecida no sitemap, ou rota
  removida deixando link morto no rodapé.
- Cada página declara `alternates.canonical` próprio. Sem isso o bug da §4.5 volta e nenhuma
  medição acusa — Lighthouse dá 100 em SEO com canonical apontando para o lugar errado.

## Fora de escopo

- Banner de cookie — não há cookie não-essencial.
- Página de subprocessadores separada; a lista cabe na seção 5 da Privacidade.
- Versionamento histórico das políticas; a data de atualização basta enquanto não há usuário
  pagante.
- Tradução. O Maré é pt-BR.

## Pendência que bloqueia a redação final

E-mail de contato definitivo. `placeholder@email.com` entra agora e sai antes de publicar —
publicar com o placeholder é pior que não ter a página, porque a seção de direitos passa a
prometer um canal que não existe.
