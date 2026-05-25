# Plano de Melhoria

## Fase 1: Segurança de domínio ✅ Concluída (2026-05-10)

Objetivo:

- impedir vínculo cruzado de dados entre usuários.

Tarefas:

- ✅ criar helpers de ownership (`lib/auth/ownership.ts`);
- ✅ validar `categoryId`, `accountId`, `groupId`, `investmentTypeId` e `goalId`;
- ✅ aplicar validação nas actions de transações, categorias, investimentos e metas;
- adicionar testes de usuário A tentando referenciar ID do usuário B.

---

## Fase 2: Validação server-side ✅ Concluída (2026-05-10)

Objetivo:

- tornar server actions uma fronteira segura.

Tarefas:

- ✅ mover ou reutilizar schemas Zod dentro das actions;
- ✅ fortalecer schemas com UUID, moeda, datas, enums e limites;
- cobrir casos inválidos com testes.

---

## Fase 3: Dependências e build ✅ Parcialmente concluída (2026-05-24)

Objetivo:

- reduzir exposição a CVEs e separar build de banco.

Tarefas:

- ✅ remover `drizzle-kit migrate` do `npm run build` (resolvido em M1);
- ✅ criar etapa explícita de migration via `vercel.json`;
- ✅ upgrade para Next.js 16.2.6 (eliminou CVEs altos do Next 14);
- ✅ migrar `@ducanh2912/next-pwa` → `@serwist/next` (eliminou cadeia de CVEs do PWA);
- rodar `npm audit fix` para `brace-expansion` (safe fix disponível);
- acompanhar patch do `postcss` dentro do Next.js (pendente upstream).

---

## Fase 4: Integridade do banco ✅ Parcialmente concluída (2026-05-10)

Objetivo:

- fazer o banco proteger invariantes do domínio.

Tarefas:

- ✅ adicionar unique indexes para registros mensais únicos;
- ✅ adicionar índices compostos para queries por usuário/mês (M3);
- avaliar enums ou checks para strings de domínio;
- ✅ migration de limpeza incluída na 0006_same_lake.sql.

---

## Fase 5: Observabilidade e testes

Objetivo:

- reduzir regressões futuras.

Tarefas:

- introduzir testes para actions e queries críticas;
- criar seed de teste com dois usuários;
- testar isolamento multiusuário;
- testar cálculos do dashboard e panorama;
- documentar decisões operacionais de deploy.

---

## Checklist Rápido Para Próximos PRs

- Toda action chama `auth()` e exige `userId`.
- Toda action valida payload no servidor com Zod.
- Todo ID relacionado é checado por ownership.
- Toda mutação multi-step é transacional ou idempotente.
- Todo dado mensal que deveria ser único tem unique index.
- Toda query frequente por `userId + referenceMonth` tem índice.
- Nenhuma migration roda implicitamente em `npm run build`.
- `npm audit` é revisado antes de release.
- Novos domínios seguem o padrão de isolamento por usuário desde a primeira fase.
