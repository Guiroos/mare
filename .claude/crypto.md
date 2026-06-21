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
- **Drizzle relational `with: {}` retorna array vazio silenciosamente** quando tabelas relacionadas têm colunas encriptadas. Substituir por `.select()` explícitos em paralelo + agrupamento com `Map` em JS.
- **Busca/filtro textual**: `WHERE col ILIKE '%termo%'` não funciona em ciphertext. Mover filtro para JS após decrypt; ou manter campo plaintext auxiliar para busca (sem dados sensíveis).
