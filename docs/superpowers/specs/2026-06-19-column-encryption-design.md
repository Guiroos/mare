# Column-Level Encryption — Design Spec

**Data:** 2026-06-19
**Status:** Aprovado

## Contexto

O Maré é um app de finanças pessoais que será aberto ao público. O objetivo desta feature é garantir que, mesmo que alguém tenha acesso direto ao banco de dados (via `DATABASE_URL`, dump, backup ou Drizzle Studio), os dados financeiros dos usuários apareçam como ciphertext ilegível.

### O que esta solução protege

- Acesso direto ao banco (psql, Drizzle Studio, backup exposto) → vê apenas cifra
- Dump físico do banco → ilegível sem o MEK
- Vazamento da `DATABASE_URL` isolada → ilegível sem o MEK

### O que esta solução não protege (escopo futuro — opção C)

- Operador com acesso tanto ao banco quanto às env vars (MEK) pode reconstruir as chaves e descriptografar
- Para proteção zero-knowledge real, seria necessária criptografia client-side com chave derivada de passphrase do usuário — mudança arquitetural significativa planejada para versão futura

---

## Hierarquia de chaves

```
MEK (env: ENCRYPTION_MASTER_KEY, 32 bytes — nunca vai ao banco)
 └── cifra o DEK de cada usuário
      └── DEK (32 bytes aleatórios por usuário, armazenado cifrado em userSettings.encryptedDek)
           └── cifra cada campo sensível com IV aleatório único por campo
```

- **MEK**: gerado uma vez com `openssl rand -hex 32`, armazenado em `ENCRYPTION_MASTER_KEY` no Vercel. Nunca logado, nunca no banco.
- **DEK**: gerado pelo servidor no primeiro login do usuário. Armazenado cifrado. Inútil sem o MEK.
- **IV**: 12 bytes aleatórios por operação de cifragem. Garante que o mesmo valor em campos diferentes gera ciphertexts distintos.
- **Algoritmo**: AES-256-GCM (cifragem autenticada — detecta adulteração do ciphertext).
- **Formato em disco**: `enc:<base64(iv [12 bytes] + authTag [16 bytes] + ciphertext)>` — o prefixo `enc:` permite distinguir plaintext de ciphertext durante a migration e re-execuções do script.

---

## Campos cifrados

### Dados financeiros

| Tabela | Campos cifrados |
|--------|----------------|
| `transactions` | `name`, `amount` |
| `fixedExpenses` | `name`, `amount` |
| `incomes` | `source`, `amount`, `investmentReturnCapital` |
| `installmentGroups` | `name`, `totalAmount` |
| `investments` | `amount`, `yieldAmount`, `notes` |
| `investmentWithdrawals` | `amount`, `taxAmount`, `notes` |
| `goals` | `name`, `targetAmount` |
| `investmentTypes` | `name` |
| `paymentAccounts` | `name` |
| `categoryGroups` | `name` |
| `categories` | `name`, `defaultBudget` |
| `monthlyBudgetOverrides` | `amount` |
| `goalContributions` | `amount` |
| `debtorEntries` | `description`, `amount`, `notes` |

### PII

| Tabela | Campos cifrados |
|--------|----------------|
| `people` | `name`, `email`, `phone`, `notes` |
| `userSettings` | `pixKey` |
| `feedback` | `message` |

### Ficam em plaintext (necessários para queries)

- Todos os `userId`, `referenceMonth`, `date` — usados em `WHERE` / `GROUP BY`
- Campos enum/estruturais: `type`, `status`, `creditMode`, `paid`, `archived`, `closingDay`, `dueDay`, `sortOrder`
- `color`, `bgColor` (visuais, não sensíveis)
- Tabelas NextAuth inteiras (`accounts`, `sessions`, `verificationTokens`, `users`) — o adapter gerencia essas queries; tokens OAuth expiram rápido e não contêm dados financeiros. `users.email` é o identificador de login e precisa de `WHERE email = $1`.

---

## Módulo de criptografia — `lib/crypto/`

### `lib/crypto/keys.ts`

Responsável pelo ciclo de vida do DEK.

```ts
generateDek(): Buffer
encryptDek(dek: Buffer, mek: Buffer): string       // → base64, para armazenar no banco
decryptDek(encrypted: string, mek: Buffer): Buffer // → Buffer, para usar em memória
getDekForUser(userId: string): Promise<Buffer>     // busca + descriptografa; usa cache() do Next.js
```

`getDekForUser` usa `cache()` do React/Next.js — deduplica chamadas dentro do mesmo request sem round-trips extras ao banco.

Se `userSettings.encryptedDek` for null (usuário antigo sem DEK), a função gera e persiste um DEK novo automaticamente.

### `lib/crypto/fields.ts`

Criptografia de valores individuais.

```ts
encryptField(plaintext: string, dek: Buffer): string  // → base64(iv + authTag + ciphertext)
decryptField(ciphertext: string, dek: Buffer): string // → plaintext original
```

Valores `null` / `undefined` são retornados sem modificação (campos opcionais).

### Invariante de segurança

O DEK nunca é logado, serializado em JSON de resposta, ou armazenado em plaintext. Circula apenas como `Buffer` em memória durante o request.

---

## Mudanças no schema (`lib/db/schema.ts`)

Campos cifrados mudam de `decimal` / `varchar` para `text` (o valor real vira base64).

```ts
// antes
amount: decimal('amount', { precision: 10, scale: 2 }).notNull()
name: varchar('name', { length: 200 }).notNull()

// depois
amount: text('amount').notNull()
name: text('name').notNull()
```

Adição em `userSettings`:

```ts
encryptedDek: text('encrypted_dek')  // null até o primeiro login pós-deploy
```

A app lê `amount` como string, descriptografa → obtém `"1234.56"` → passa por `toAmount()` normalmente. Nenhuma mudança na lógica de negócio além das fronteiras de encrypt/decrypt.

---

## Integração com actions e queries

A criptografia acontece exclusivamente nas bordas: ao inserir (actions) e ao ler (queries). O resto do código não muda.

### Actions (INSERT / UPDATE)

```ts
const dek = await getDekForUser(userId)
await db.insert(transactions).values({
  userId,
  referenceMonth,                        // plaintext — WHERE
  date,                                  // plaintext — WHERE
  name: encryptField(data.name, dek),
  amount: encryptField(data.amount, dek),
})
```

### Queries (SELECT)

```ts
const rows = await db.select().from(transactions).where(...)
const dek = await getDekForUser(userId)
return rows.map(row => ({
  ...row,
  name: decryptField(row.name, dek),
  amount: decryptField(row.amount, dek),
}))
```

Como o Maré já faz todas as agregações em JS (sem `SUM` no SQL), descriptografar amounts antes dos cálculos é transparente para a lógica existente.

---

## Migration de dados existentes

Script único: `scripts/encrypt-existing-data.ts`

1. Busca todos os usuários sem `encryptedDek`
2. Para cada usuário: gera DEK, armazena cifrado no banco
3. Para cada tabela com campos cifrados: SELECT de todos os registros do usuário
4. Criptografa os campos e faz UPDATE em batches de 100 rows
5. Detecta registros já cifrados pelo prefixo `enc:` — seguro para re-execução sem duplicar cifragem

O script usa `dotenv` com `.env.local` (padrão dos scripts em `scripts/`) e roda uma única vez em produção via `npx tsx scripts/encrypt-existing-data.ts`.

---

## Evolução futura (opção C — zero-knowledge)

Para proteção total onde nem o operador consegue descriptografar:

- DEK derivado de passphrase do usuário via PBKDF2/Argon2 (nunca armazenada)
- Passphrase coletada em tela separada pós-login OAuth
- Sem passphrase = sem acesso; sem recuperação possível
- Requer mudança no fluxo de login e estratégia de UX para recuperação parcial de dados

Esta versão (server-generated DEK) é a fundação correta para essa evolução: a hierarquia MEK → DEK → campos já existe; só a origem do DEK muda.
