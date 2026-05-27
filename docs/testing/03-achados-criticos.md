# Testing — Achados Críticos

## A1 — Semântica divergente em `deleteInstallmentGroup`

**Severidade:** alta — **resolvido**

**Decisão:** excluir a compra parcelada inteira — grupo + todas as transações.

O schema mantém `onDelete: 'set null'` no FK `transactions.installmentGroupId`
(comportamento do banco ao deletar o grupo diretamente), mas a semântica de
produto é diferente: ao cancelar uma compra parcelada, nenhuma parcela deve
sobrar no histórico.

A action `deleteInstallmentGroup` em `lib/actions/transactions.ts` agora envolve
os dois `DELETE` em `db.transaction()`, garantindo atomicidade: se o segundo
`DELETE` falhar, o primeiro faz rollback automaticamente.

`installments-delete.test.ts` documenta o comportamento do banco (FK `set null`);
`actions-transactions.test.ts` documenta o comportamento da aplicação (cascade
via action atômica).

## A2 — `NEON_PARENT_BRANCH_ID` é obrigatório no processo, mas opcional no código

**Severidade:** alta — **resolvido**

`__tests__/integration/env-setup.ts` agora valida `NEON_API_KEY`,
`NEON_PROJECT_ID` e `NEON_PARENT_BRANCH_ID` logo após carregar o `.env.local`.
Se qualquer variável estiver ausente, a suíte falha imediatamente com mensagem
explícita indicando qual variável falta e lembrando que `NEON_PARENT_BRANCH_ID`
deve apontar para o branch dev.

`setup.ts` usa non-null assertion (`!`) em `parentBranchId`, alinhado com a
validação de preflight.

## A3 — Coverage unitário é enganoso

**Severidade:** média

`npm run test:coverage` roda a config unitária, mas inclui `lib/actions/**` e
`lib/queries/**` no escopo de coverage. Como ações e queries são testadas pela
config de integração, o relatório atual mostra `0%` nessas pastas mesmo quando
existe teste em `__tests__/integration`.

Impacto:

- percentual global perde valor;
- pode gerar sensação falsa de regressão ou progresso;
- dificulta uso de thresholds.

Recomendação:

- renomear o relatório atual para `test:coverage:unit`; ou
- restringir coverage unitário a `lib/utils/**` e `lib/validations/**`; e
- criar depois uma estratégia separada para coverage de integração.

## A4 — Testes de action ainda cobrem pouco auth e ownership

**Severidade:** média

`actions-debtors.test.ts` já chama actions reais e valida persistência no banco,
o que é um avanço importante. Porém os mocks de ownership ficam configurados para
resolver com sucesso, e a maioria dos casos cobre caminho feliz.

Impacto:

- regressões de autorização podem escapar;
- asserts chamados com IDs errados podem passar;
- validações negativas ficam sub-representadas.

Recomendação:

- adicionar casos com `mockRejectedValueOnce(new Error('Não autorizado'))`;
- testar `requireUserId` rejeitando;
- verificar chamadas com `toHaveBeenCalledWith(userId, id)`;
- cobrir pelo menos um input inválido por action prioritária.

## A5 — Alguns testes de integração replicam lógica de action

**Severidade:** média

Arquivos de schema usam Drizzle direto para demonstrar invariantes do banco. Isso
é válido quando o alvo é FK, constraint ou rollback SQL. O problema aparece
quando o teste replica manualmente uma regra de action e o nome sugere cobertura
da aplicação.

Exemplos:

- guarda local equivalente a `deletePersonIfEmpty`;
- transação manual equivalente a `createWithdrawal`;
- operação manual equivalente a `deleteDebtEntry` com `alsoDeleteIncome`.

Impacto:

- regressão na action real não é detectada;
- duplicação de lógica aumenta custo de manutenção;
- o leitor pode superestimar a cobertura.

Recomendação:

- manter esses casos como `schema`/`db contracts`;
- criar testes de action separados para regras de aplicação;
- usar nomes que explicitem quando o teste é contrato de banco e não action real.

## A6 — Dynamic import como requisito arquitetural é frágil

**Severidade:** média

O padrão de import dinâmico é necessário porque `lib/db/index.ts` cria o pool no
nível do módulo. Um import estático acidental de action antes do setup Neon pode
capturar `DATABASE_URL` errada.

Impacto:

- falhas intermitentes ou conexão no banco de desenvolvimento;
- onboarding mais difícil;
- dependência forte de disciplina manual.

Recomendação:

- curto prazo: manter regra documentada e exemplos claros;
- médio prazo: estudar `getDb()` lazy ou factory de DB para testes;
- longo prazo: reduzir efeitos colaterais em import de módulos server-side.

## A7 — Integração sem CI versionado

**Severidade:** média — **resolvido**

`.github/workflows/ci.yml` criado com dois jobs:

- `validate`: roda em todo PR (`format:check`, `lint`, `typecheck`, `npm test`)
- `integration`: roda apenas em push para `main`, após `validate`, com secrets
  Neon

Para ativar a proteção completa, configurar no GitHub:

- Branch protection em `main` com o check `Lint, Typecheck & Unit Tests`
- (Opcional) Vercel Required Checks com o mesmo nome de job

## A8 — E2E ainda não existe como suíte formal

**Severidade:** baixa a média

O projeto ainda não tem `@playwright/test`, `playwright.config.ts` nem
`__tests__/e2e/`.

Impacto:

- fluxos de UI podem quebrar com testes unitários e de integração passando;
- auth, navegação e formulários multi-step ficam sem cobertura automatizada.

Recomendação:

- iniciar pequeno;
- não testar OAuth Google real;
- preferir usuário de teste, storage state ou modo controlado de auth;
- cobrir primeiro dashboard, registro e devedores.
