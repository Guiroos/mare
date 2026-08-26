# Criptografia — AES-256-GCM por usuário

Arquitetura MEK/DEK: uma Master Encryption Key (env `ENCRYPTION_MASTER_KEY`) decripta a DEK (Data Encryption Key) de cada usuário armazenada em `userSettings.encryptedDek`. Toda operação de campo passa pelo par `(value, dek)`.

Módulos: `lib/crypto/keys.ts` (MEK, DEK, `getDekForUser`) e `lib/crypto/fields.ts` (`encryptField`, `decryptField`, `encryptOptional`, `decryptOptional`).

## API

- `getDekForUser(userId)` — usa React `cache()`; deduplicado por request. Pode ser chamado em paralelo com outras queries sem overhead extra (`Promise.all([..., getDekForUser(userId)])`).
- `decryptField(value, dek)` — backward-compat: se `value` não começa com `enc:`, retorna o valor sem decrypt. Plaintext antigo é legível sem re-migration.
- `decryptOptional(value, dek)` — para campos nullable em JOINs LEFT; retorna `null` quando value é null. Nunca usar `decryptField` em campo que pode ser null (`decryptField(null)` lança).
- `encryptOptional(value, dek)` — retorna `null` se value é null.

## Gotchas de queries com colunas encriptadas

- **`ORDER BY` quebrado**: `ORDER BY col_encriptada` ordena ciphertext lexicograficamente (inútil). Remover da query SQL; ordenar em JS após decrypt: `.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))`.
- **`SUM`/`GROUP BY` quebrado**: SQL não consegue somar ciphertext. Substituir por dois selects paralelos + agregação em JS:
  ```ts
  const [personRows, entryRows, dek] = await Promise.all([...])
  for (const e of entryRows) {
    balance[e.personId] += toAmount(decryptField(e.amount, dek))
  }
  ```
- **Drizzle relational `with: {}` — o alerta original era largo demais; leia antes de usá-lo como argumento.** A redação anterior dizia que `with: {}` "retorna array vazio silenciosamente quando tabelas relacionadas têm colunas encriptadas", e isso não se sustenta: há **16 call sites** de `with: {}` sobre relações com `name` cifrado rodando em produção hoje, sem contar os aninhados (`dashboard.ts:57,130,160,197`, `historico.ts:117,129,140`, `panorama.ts:198`, `categories.ts:17,75`, `transactions.ts:12,35`, `investments.ts:176,188,207`, `goals.ts:32`) — incluindo o que monta o dashboard inteiro, cujo `dashboard.ts:130` decripta `row.category.name`/`row.account.name` logo abaixo, em `:139-140`. Se a regra valesse como escrita, a tela principal estaria vazia. Não há mecanismo plausível: ciphertext é conteúdo opaco numa coluna `text`, e o query builder relacional não lê valor para montar o join.

  O que de fato aconteceu, uma vez: `getActiveInstallmentGroups` usava `with: { transactions: true, account: true, category: true }` e `group.transactions` vinha vazio (`40636e0`). Era a relação **`many()`**, não as `one()` do mesmo objeto — `account` e `category` (ambas cifradas) funcionavam ali. A causa nunca foi isolada à criptografia; o commit atribuiu a ela e a regra generalizou a partir de um caso. A correção continua certa (`.select()` explícitos em paralelo + `Map` em JS) e `parcelas.ts` segue assim, mas o **motivo** documentado é suspeito.

  Uso prático: não abra achado de auditoria contra `with: {}` invocando esta linha. Se um `many()` vier vazio, reproduza — teste de integração contra branch Neon é o que fecha isso de vez, e ninguém rodou. Este candidato já morreu duas vezes no PASSO 3.5 (2026-08-17 em `panorama.ts:198`, 2026-08-20 em `historico.ts:117`).
- **Busca/filtro textual**: `WHERE col ILIKE '%termo%'` não funciona em ciphertext. Mover filtro para JS após decrypt; ou manter campo plaintext auxiliar para busca (sem dados sensíveis).

## Gotchas de escrita e backfill

- **Toda escrita derivada precisa cifrar**: fluxos que criam `incomes`/`debtorEntries` a partir de outra entidade (splits de transação em `transactions.ts`, `settleCharge`/`createDebtPayment` em `debtors.ts`, resgates em `investments.ts`) devem passar `source`/`amount`/`description` por `encryptField` — é fácil esquecer porque o insert não é o "principal" da action. `decryptField` é backward-compat e passa plaintext adiante, então o vazamento fica invisível na UI e só aparece olhando o banco.
- **Nunca interpolar ciphertext em string**: `` `${person.name} — ${charge.description}` `` com valores cifrados gera `enc:AAA — enc:BBB`, que começa com `enc:` mas **não decifra** (auth tag GCM falha) — corrompe o campo. Para derivar uma string legível de campos cifrados: `encryptField(\`${decryptField(a, dek)} — ${decryptField(b, dek)}\`, dek)`. Para copiar um valor que já vem cifrado do banco, `encryptField(decryptField(x, dek), dek)` normaliza (robusto para plaintext antigo ou já cifrado).
- **Backfill idempotente com campo nullable**: o guard "precisa cifrar?" de coluna nullable deve ser `campo != null && !isEncrypted(campo)`. Sem o `!= null`, `!isEncrypted(null)` é sempre `true` → a linha reaparece em todo run e `encryptOptional(null)` regrava `null` (falso-positivo eterno). Ver `scripts/encrypt-existing-data.ts`, que também repara `source` de income corrompido via `isDecryptable` (try/catch no decrypt) reconstruindo a partir de `debtorEntries.incomeId`/`investmentWithdrawals.incomeId`.
