# Cobrança via WhatsApp — Devedores

**Data:** 2026-06-16
**Status:** aprovado

## Objetivo

Permitir que o usuário envie uma mensagem de cobrança formatada via WhatsApp para pessoas cadastradas em Devedores, com lista das cobranças em aberto e chave Pix. Quando a pessoa não tem telefone cadastrado, exibe a mensagem copiável.

---

## 1. Banco de dados

### Alteração em `userSettings`

Adicionar coluna `pixKey varchar(100)` — nullable, sem backfill.

```sql
ALTER TABLE "user_settings" ADD COLUMN "pix_key" varchar(100);
```

Gerar via `npm run db:generate` e aplicar com `npm run db:migrate`.

---

## 2. Chave Pix na página de Devedores

### Card permanente no topo de `/devedores`

Componente: `PixKeyCard` em `components/devedores/PixKeyCard.tsx` — client component.

**Estado sem chave cadastrada:**
- Card com borda tracejada, label "Sua chave Pix", texto "Não cadastrada", botão "+ Cadastrar"

**Estado com chave cadastrada:**
- Card com borda sólida, label "Sua chave Pix", exibe a chave em destaque, botão "Editar"

**Interação:** clicar em "Cadastrar" ou "Editar" abre um Dialog/Drawer inline (sem navegação) com:
- `Field` + `Input` para a chave Pix (qualquer tipo: CPF, e-mail, telefone, chave aleatória)
- Botão "Salvar" → chama `updatePixKey(formData)` → fecha dialog

**Props:**
```ts
{ pixKey: string | null }
```

O page server component de `/devedores` busca `userSettings` do usuário e passa `pixKey` para `PixKeyCard`.

---

## 3. Componente `CobrancaDialog`

Arquivo: `components/devedores/CobrancaDialog.tsx` — client component.

### Props

```ts
interface CobrancaDialogProps {
  person: { id: string; name: string; phone: string | null }
  openCharges: OpenChargeForLinking[]   // tipo já existe em lib/queries/debtors.ts
  pixKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

### Estrutura responsiva

Dialog (≥ 1024px) + Drawer (< 1024px) — mesmo padrão de `DeleteButton`/`InvestmentEntryDialog`.

### Estado interno

- `selectedIds: Set<string>` — inicializado com todos os IDs de `openCharges` quando o dialog abre

### Conteúdo

**Header:** "Cobrar via WhatsApp" + nome da pessoa + telefone (ou "sem telefone")

**Lista de cobranças:** para cada `openCharge`:
- Checkbox (`<input type="checkbox" className="accent-accent">` dentro de `<Label>`)
- Descrição (truncada)
- Data formatada em DD/MM/AAAA
- Valor à direita (`tabular-nums`)

**Preview da mensagem:** atualiza em tempo real conforme seleciona/desseleciona.
- Com telefone: fundo verde claro (estilo balão de WhatsApp)
- Sem telefone: fundo cinza (`bg-bg-subtle`)

**Footer:**
- Esquerda: `{n} selecionadas · R$ {total}`
- Direita:
  - **Com telefone:** botão `variant="positive"` "Abrir WhatsApp" → `window.open(waUrl, '_blank')`
  - **Sem telefone:** botão `variant="secondary"` "Copiar mensagem" → `navigator.clipboard.writeText(msg)` + toast "Copiado!"

**Aviso sem telefone:** banner `warning` acima da lista com texto "X não tem telefone cadastrado. Copie a mensagem abaixo e envie manualmente." + link "Cadastrar telefone →" que dispara `onOpenChange(false)` e abre o `PersonDialog mode="edit"` existente.

### Abertura do PersonDialog para cadastrar telefone

O componente pai (que renderiza tanto `CobrancaDialog` quanto `PersonDialog`) controla ambos os `open` states. Quando o link é clicado, fecha `CobrancaDialog` e abre `PersonDialog`.

---

## 4. Template da mensagem

```
Olá {name}! 👋

Passando para lembrar dos valores em aberto:

• {descrição} ({DD/MM/AAAA}) — R$ {valor}
• ...

Total: R$ {total}

Minha chave Pix: {pixKey}
```

- Se `pixKey` for null: omite a linha "Minha chave Pix"
- Se `selectedIds` estiver vazio: mensagem vazia, botão desabilitado
- Formatação monetária: `formatCurrency` de `lib/utils/currency.ts`

### Formatação do telefone para `wa.me`

Utilitário `formatPhoneForWhatsApp(phone: string): string` em `lib/utils/phone.ts`:
1. Strip tudo que não for dígito
2. Se não começar com `55`, prepend `55`
3. URL: `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`

---

## 5. Integração — Kebab menu (RowActions)

"Cobrar via WhatsApp" entra como item em `additionalActions` do `RowActions` existente — sem novo botão visível na UI além do kebab.

### Página de lista `/devedores`

**Nova query:** `getOpenChargesForPeople(userId: string, personIds: string[])`

```ts
// Retorna todas as cobranças abertas de múltiplas pessoas em uma query
// inArray(debtorEntries.personId, personIds) com guard: if (personIds.length === 0) return {}
// Retorno: Record<personId, OpenChargeForLinking[]>
```

O page server component busca a lista de pessoas e faz a query batch. Cada linha da lista recebe `openCharges` já filtradas + `pixKey`.

### Página de detalhe `/devedores/[id]`

`openCharges` já existe via `getOpenChargesForPerson`. Só precisa:
- Buscar `pixKey` de `userSettings` junto com os outros dados do page (paralelo no `Promise.all`)
- Passar para `CobrancaDialog`
- Adicionar "Cobrar via WhatsApp" em `additionalActions` do `RowActions` no header da página

---

## 6. Action — `updatePixKey`

Arquivo: `lib/actions/settings.ts` — **já existe**, adicionar função:

```ts
// requireUserId()
// parse: z.object({ pixKey: z.string().max(100).nullable() })
// upsert em userSettings via onConflictDoUpdate (mesmo padrão de updateAutoRollover)
// revalidatePath('/devedores')
```

Query de leitura: adicionar `getUserPixKey(userId)` em `lib/queries/settings.ts` — **já existe**, seguir padrão de `getUserAutoRollover` com `columns: { pixKey: true }`.

---

## 7. Checklist de arquivos

| Arquivo | Tipo | Descrição |
|---|---|---|
| `lib/db/schema.ts` | editar | add `pixKey` em `userSettings` |
| `lib/db/migrations/*` | gerar | `db:generate` + `db:migrate` |
| `lib/utils/phone.ts` | criar | `formatPhoneForWhatsApp` |
| `lib/actions/settings.ts` | editar | add `updatePixKey` |
| `lib/queries/settings.ts` | editar | add `getUserPixKey` |
| `lib/queries/debtors.ts` | editar | add `getOpenChargesForPeople` |
| `components/devedores/PixKeyCard.tsx` | criar | card permanente com dialog inline |
| `components/devedores/CobrancaDialog.tsx` | criar | dialog de seleção + preview + ação |
| `app/(app)/devedores/page.tsx` | editar | buscar pixKey + openCharges batch; render PixKeyCard + passar dados às linhas |
| `app/(app)/devedores/[id]/page.tsx` | editar | buscar pixKey; passar para CobrancaDialog; adicionar ao RowActions |

---

## Fora do escopo (MVP)

- Múltiplas chaves Pix
- Cadastro de dados bancários completos (banco, agência, conta)
- Envio automático via API (requer WhatsApp Business API)
- Histórico de cobranças enviadas
