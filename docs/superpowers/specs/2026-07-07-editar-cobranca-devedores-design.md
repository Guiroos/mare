# Editar cobrança em aberto (devedores)

## Problema

No detalhe de um devedor, cada lançamento (`debtorEntries`) só permite **Quitar** e
**Excluir**. Não há como corrigir uma cobrança já registrada. Caso motivador: uma compra
parcelada lançada via dívida compartilhada, cujas cobranças começaram a ser feitas um mês
depois — o usuário precisa trocar a **data** (e, por consequência, o mês de referência) e o
**nome** da cobrança sem apagar e recriar tudo.

## Escopo

- Editar **apenas cobranças em aberto** — `type = 'charge'` e `status` `'open'` ou `null`.
  Pagamentos, ajustes e cobranças já quitadas ficam de fora (evita reconciliar vínculos com
  `income`, `settledCharges` e o pagamento que quitou a cobrança).
- Campos editáveis: **descrição**, **data** (`entryDate`) e **observações** (`notes`).
- **Valor é imutável.** Cobranças vindas de dívida compartilhada têm o valor derivado do
  split da transação de origem; permitir editar abriria margem para divergir do original sem
  benefício para o caso de uso.
- O vínculo com a transação de origem (`sourceTransactionId`) não é tocado.
- Sem mudança de schema — logo, **sem migration**.

## Componentes

### 1. Schema de validação — `lib/validations/debtors.ts`

```ts
export const updateDebtChargeSchema = z.object({
  id: uuidSchema,
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  entryDate: dateSchema,
  notes: z.string().optional(),
})
```

Espelha `debtChargeSchema` sem `amount` nem `personId` (o `personId` é derivado da entry no
servidor; não vem do cliente).

### 2. Action — `updateDebtCharge` em `lib/actions/debtors.ts`

Segue o padrão obrigatório de action com mutação:

1. `const userId = await requireUserId()`
2. `updateDebtChargeSchema.parse(data)`
3. `await assertOwnsDebtEntry(userId, data.id)`
4. Busca a entry (`columns: { type, status, personId }`); se não encontrada, lança
   `'Lançamento não encontrado'`.
5. **Guard de escopo:** se `type !== 'charge'` ou `status` não for `'open'`/`null`, lança
   `'Só é possível editar cobranças em aberto'`. Protege no servidor, não só na UI.
6. `const dek = await getDekForUser(userId)`
7. `db.update(debtorEntries).set({...})`:
   - `description: encryptField(data.description.trim(), dek)`
   - `entryDate: data.entryDate`
   - `referenceMonth: entryDateToReferenceMonth(data.entryDate)` — recálculo é o que faz a
     cobrança migrar para o mês correto no agrupamento da lista.
   - `notes: encryptOptional(data.notes?.trim() || null, dek)`
   - `updatedAt: new Date()`
   - `where(and(eq(id), eq(userId)))`
8. `revalidatePath('/devedores')` + `revalidatePath('/devedores/${personId}')` (personId
   vindo da entry buscada).

Tipo de input:

```ts
export type UpdateDebtChargeInput = {
  id: string
  description: string
  entryDate: string
  notes?: string
}
```

### 3. Componente — `components/devedores/EditChargeDialog.tsx`

Molde do `SettleChargeDialog`:

- Controlado por `open` / `onOpenChange`; responsivo `Dialog` (≥1024px) / `Drawer` (mobile)
  via `useMediaQuery`.
- Props: `entry: DebtEntryDetail`, `open?`, `onOpenChange?`.
- Três `Field`s do DS, pré-preenchidos a partir de `entry`:
  - Descrição → `Input` (`defaultValue={entry.description}`, `autoFocus`)
  - Data → `Input type="date"` (`defaultValue={entry.entryDate}`)
  - Observações → `Textarea` (`defaultValue={entry.notes ?? ''}`)
- Submit: monta objeto, valida com `updateDebtChargeSchema.safeParse` + `formatZodErrors`,
  chama `updateDebtCharge` dentro de `startTransition`. Fecha **só no `try`**; `catch`
  dispara `toast.error`. Botão "Cancelar" chama `onOpenChange(false)`.

### 4. Fiação — `components/devedores/DebtEntryList.tsx`

- Novo state `const [editEntry, setEditEntry] = useState<DebtEntryDetail | null>(null)`.
- `EntryRow` recebe callback `onEdit: (entry) => void`.
- No ramo `isOpenCharge` do `RowActions`, adicionar `onEdit={() => onEdit(entry)}` — convive
  com a ação "Quitar" (em `additionalActions`) e o "Excluir" (`onDelete`).
- Render condicional do `EditChargeDialog` quando `editEntry` não for null, no mesmo padrão
  dos outros dialogs do arquivo.

## Data flow

`DebtEntryList` (client) → usuário clica Editar no `RowActions` → `setEditEntry(entry)` →
`EditChargeDialog` abre pré-preenchido → submit → `updateDebtCharge(action)` →
`db.update` + `revalidatePath` → Server Component recarrega e a cobrança aparece no mês novo.

## Tratamento de erros

- Validação de formulário: erros por campo via `formatZodErrors` exibidos no `Field`.
- Falha da action: `toast.error('Erro ao editar cobrança.')`; dialog permanece aberto.
- Guard de escopo no servidor: entry que não é cobrança aberta → erro lançado (defesa em
  profundidade; a UI já só oferece Editar para `isOpenCharge`).

## Testes

Integração em `__tests__/integration/debtors.test.ts` (banco real, dynamic import da action):

- Atualiza `description`/`entryDate`/`notes` e persiste cifrado (verificar decrypt).
- Ao mudar a data para outro mês, `referenceMonth` é recalculado corretamente.
- Rejeita entry que não é cobrança aberta (ex.: `type='payment'` ou `status='settled'`).
- Chama `assertOwnsDebtEntry(userId, id)` e revalida `/devedores` + `/devedores/${personId}`.

## Fora de escopo

- Editar valor da cobrança.
- Editar pagamentos, ajustes ou cobranças quitadas.
- Alterar o vínculo com a transação de origem.
