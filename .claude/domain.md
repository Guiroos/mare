# Domínios — Regras de Negócio

Referenciado por `CLAUDE.md` via `@`. Para o domínio de fatura (regime de cartão): **@domain-fatura.md**

---

## Parcelas

- 1 `installmentGroup` + N `transaction` rows com nome `"<name> (i/N)"`
- `closingDay` da conta define se a 1ª parcela pertence ao mês atual ou seguinte — usar `calcBaseReferenceMonth`/`calcInstallmentDate` em `lib/utils/date.ts`; `closingDay <= 1` é tratado como calendário
- `paidInstallments` usa `referenceMonth < currentMonthStr` (mês atual é pendente) — `<=` faria o mês corrente aparecer como "pago" e sumir do gráfico Compromissos por mês
- `installmentAmount = parseFloat((totalAmount / totalInstallments).toFixed(2))` — sem `.toFixed(2)`, drift de float corrompe `remainingAmount` ao multiplicar por `remainingInstallments`
- `getActiveInstallmentGroups` filtra por `remainingInstallments > 0`; `getInstallmentTimeline` cobre os próximos 12 meses via `futureNMonths(12)`
- `installmentGroups` FK para `transactions` é `set null`, mas semântica de produto é excluir tudo — `deleteInstallmentGroup` usa `db.transaction()`: deleta transactions primeiro, depois o grupo

## Devedores

- `people` (cadastro) + `debtorEntries` (lançamentos); `type`: `charge` | `payment` | `adjustment`
- `balance > 0` = pessoa deve a você; `status` `null`/`'open'` são equivalentes (pré-migration ficaram como `null`)
- `settleCharge` (Fluxo A) é atômico via `db.transaction`; `createDebtPayment` aceita `settleChargeIds[]` (Fluxo B)
- Ao deletar payment: `UPDATE status='open'` **antes** do DELETE — `ON DELETE SET NULL` não reseta `status`
- `deletePersonIfEmpty` deleta; se houver histórico, usar `archivePerson` (archived: true)
- `createDebtPayment` com `createIncome: true` cria income — ao deletar, passar `alsoDeleteIncome: true`
- `pixKey` em `userSettings.pixKey`; `getUserPixKey(userId)` / `updatePixKey(pixKey | null)` (upsert por userId); exibido via `PixKeyCard` em `/devedores`
- `getOpenChargesForPeople(userId, personIds)` — variante batch de `getOpenChargesForPerson`; retorna `Record<string, OpenChargeForLinking[]>`; usar em list pages para evitar N queries por pessoa
- `CobrancaDialog` (`components/devedores/CobrancaDialog.tsx`): recebe `openCharges: OpenChargeForLinking[]` + `pixKey: string | null` + `onEditPhone?`; quando `person.phone` é null exibe botão "Copiar mensagem" em vez de "Abrir WhatsApp"; usa `buildDebtMessage(name, charges, pixKey)` e `formatPhoneForWhatsApp(phone)` de `lib/utils/`

## Investimentos

- `destination` em `investmentWithdrawals`: `'income'` = caixa (cria income); `'reinvest'` = rolagem (cria income com `investmentReturnCapital`); `'transfer'` = entre tipos (sem income)
- `deleteWithdrawal` remove income vinculado via `db.transaction`; nunca deletar income diretamente de um resgate
- `incomes.investmentReturnCapital` deve ser subtraído de `totalIncomes` em: `getDashboardData`, `getAnnualOverview`, `getMonthlyEvolution`
- Saldo em JS: usar `Math.round(balance * 100)` para comparar com zero (float precision)
- `getPatrimonyTimeline` — `aporte` é capital líquido: desconta resgates brutos (`amount + taxAmount`); `PatrimonyHero` exibe `totalYield` só de tipos ativos
- `investments.excludeFromCashFlow` — quando `true`, o aporte é excluído do fluxo de caixa em `getDashboardData`, `getMonthlyEvolution` e `getAnnualOverview`; usar em reinvestimentos (resgate de A que vira aporte em B) para evitar dupla contagem
- `investmentWithdrawals.amount` é valor líquido (bruto − imposto); saldo deve somar bruto: `amount + coalesce(taxAmount, 0)`
- `DEFAULT_INVESTMENT_TYPE_COLOR` / `DEFAULT_INVESTMENT_TYPE_BG_COLOR` em `lib/utils/color.ts` — usar quando `investmentType.color` é null; `deriveBgColor(hex)` gera bgColor como mix 12% cor + 88% branco

## Metas

- `GoalWithProgress` tem dois modos de saldo: vinculado a `investmentType` (total aportes + rendimentos − resgates brutos) vs manual (soma de `goalContributions`)
- `projectedCompletionYearMonth`: média dos últimos 3 meses de aporte/rendimento; `null` se sem histórico ou meta já atingida
- `goalContributions.source = 'manual'` — único valor atual; campo reservado para futuras integrações automáticas
- Assimetria de FK: `investmentTypes.goalId` é `ON DELETE SET NULL`; `goalContributions.goalId` é `ON DELETE CASCADE`

## Panorama

- **activeMonths**: `overview.filter(m => m.month <= currentYearMonth())` — nunca `m.totalIncomes > 0`
- tfoot usa `totalExpensesYTD`; saldo: `income - expenses - invested`; média de investimentos usa `monthsWithInvestment` como divisor
- Comparações YTD: filtrar `prevOverview` pelos meses ativos do ano atual (`.slice(5)` para extrair `MM` antes de montar o Set)
- `getAnnualOverview` soma `transactions` **e** `fixedExpenses` para despesas mensais — toda action que revalida `/dashboard` por dado financeiro (incomes, transactions, fixedExpenses, investments, withdrawals) deve também chamar `revalidatePath('/panorama')`; exceção: budget overrides em `categories.ts`

## Histórico

- Feed multi-tabela: `getHistoricoFeed` agrega `transactions`, `fixedExpenses`, `incomes`, `investments`, `investmentWithdrawals` em memória, ordena por data e aplica cursor-based pagination (`PAGE_SIZE = 50`)
- Cursor: string `"YYYY-MM-DD_uuid"` — retoma do último item; `fetchMoreHistorico` (action) executa no servidor
- Filtro textual `q`: aplicado em JS após decrypt, não no SQL — não tentar mover para `WHERE`
- `parseHistoricoParams`/`buildHistoricoUrl` em `lib/utils/historico-params.ts` — normaliza e serializa os 6 filtros (`de`, `ate`, `tipos`, `categorias`, `contas`, `q`); defaults: últimos 90 dias, todos os `TipoKind`
- `referenceMonthsInRange(de, ate)` e `fixedExpenseDate(referenceMonth, dueDay)` em `lib/queries/historico.ts` — helpers para buscar e mapear gastos fixos no feed; necessários porque `fixedExpenses` não têm coluna `date`

## Cron

- Neon não suporta `pg_cron`; jobs em `vercel.json` (`"crons": [{ "path": "...", "schedule": "..." }]`); autenticação via `Authorization: Bearer ${CRON_SECRET}`
- Rotas de cron não têm sessão — operam direto no `db`; usar `Promise.allSettled` por usuário
- `autoRolloverFixedExpenses` (cron, dia 1): pula se já há gastos fixos no mês; manual (`copyFixedExpensesFromPrevMonth`) substitui tudo

## Reset de Conta

- 3 fases: (1) delete completo em `db.transaction` incluindo `userSettings`/`encryptedDek`; (2) `getDekForUser` provisiona nova DEK (cria `userSettings` do zero); (3) seed de categorias padrão com nomes encriptados
- Ordem de delete importa por FK: `goalContributions` → `investmentWithdrawals` → `investments` → `investmentTypes`; `transactions` → `installmentGroups`; depois `incomes`, `fixedExpenses`, `userSettings`, `paymentAccounts`, `categories`, `categoryGroups`
- `revalidatePath('/', 'layout')` ao final — invalida todo o shell autenticado

## Feedback

- `feedback.category`: `'melhoria' | 'implementacao' | 'outros'`; `feedback.status`: `'new' | 'read' | 'done' | 'dismissed'` (default `'new'`)
- `feedback.message` é criptografado via DEK do usuário; `feedback.page` é plaintext
- Admin: `updateFeedbackStatus` autentica via `session.user.email === process.env.ADMIN_EMAIL` (não usa `requireUserId`)
- `getAllFeedbacks` agrupa DEK lookups por `userId` para minimizar roundtrips ao KMS
